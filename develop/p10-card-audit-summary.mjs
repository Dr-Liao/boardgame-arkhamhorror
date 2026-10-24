// P10 逐卡行为审计汇总：把 artifacts/tcu-audit/results/*.json 合并成一份报告，
// 并给 34 个关联面按「主卡审计结论」补面级结论（面行为随主卡翻面/结算一并核对）。
// 只读结果与目录数据，写 artifacts/tcu-audit/summary.json，不改内容文件。
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const { ALL_CARDS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))
const resultsDir = new URL('artifacts/tcu-audit/results/', new URL('../', import.meta.url))
const files = existsSync(resultsDir) ? readdirSync(resultsDir).filter(file => file.endsWith('.json')) : []
const batches = files.map(file => JSON.parse(readFileSync(new URL(file, resultsDir), 'utf8')))
const cards = new Map()
const duplicate = []
for (const batch of batches) {
  for (const card of batch.cards || []) {
    if (!/^05\d{3}[a-z]?$/.test(card.code)) continue
    if (cards.has(card.code)) duplicate.push(card.code)
    else cards.set(card.code, { ...card, batch: batch.batch })
  }
}

// 34 个关联面：用主卡的审计结论文本作为面的行为证据（面没有独立行为文件，翻面/结算由主卡逻辑负责）。
const faces = Object.keys(ALL_CARDS).filter(code => /^05\d{3}[a-z]$/.test(code)).sort()
const faceVerdicts = faces.map(code => {
  const face = ALL_CARDS[code]
  const linked = face.linkedCardCode || face.linkedToCode || null
  const main = linked && cards.get(linked)
  const relation = main ? `关联面，行为随主卡 ${linked} 的翻面/结算一并核对` : '关联面（未找到已审计主卡）'
  return {
    code,
    name: face.nameZh || face.name,
    verdict: main ? main.verdict : 'gap',
    note: main ? relation : `${relation}；待人工复核`,
    evidenceBatch: main?.batch || null,
  }
})

const counts = {}
const nonMatch = []
for (const card of cards.values()) {
  counts[card.verdict] = (counts[card.verdict] || 0) + 1
  if (card.verdict !== 'match' && card.verdict !== 'not-applicable') {
    nonMatch.push({
      code: card.code,
      name: card.name,
      verdict: card.verdict,
      note: String(card.note || '').slice(0, 600),
      batch: card.batch,
      missing: (card.clauses || []).filter(clause => clause.status === 'missing' || clause.status === 'approximation')
        .map(clause => `${clause.text}（${clause.status}）`).slice(0, 10),
    })
  }
}
const faceNonMatch = faceVerdicts.filter(face => face.verdict !== 'match' && face.verdict !== 'not-applicable')
  .map(face => ({ ...face, verdict: face.verdict, note: String(face.note).slice(0, 600) }))

// 批次覆盖：343 主卡是否全部有结论。
const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const missingMain = mainCodes.filter(code => !cards.has(code))
const summary = {
  generatedFrom: files.sort(),
  batches: batches.map(batch => batch.batch),
  duplicatedCodes: [...new Set(duplicate)],
  totals: {
    mainCards: mainCodes.length,
    auditedMainCards: cards.size,
    missingMainCards: missingMain.length,
    faces: faces.length,
    verdicts: counts,
    faceVerdicts: faceVerdicts.reduce((result, face) => {
      result[face.verdict] = (result[face.verdict] || 0) + 1
      return result
    }, {}),
  },
  missingMainCards: missingMain,
  nonMatch,
  faceVerdicts,
  faceNonMatch,
}
writeFileSync(new URL('../artifacts/tcu-audit/summary.json', import.meta.url),
  `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary.totals, null, 1))
console.log('non-match:', nonMatch.length, 'face non-match:', faceNonMatch.length)
for (const item of nonMatch.slice(0, 12)) console.log(`- ${item.code} ${item.name}: ${item.verdict} | ${item.missing.join('；').slice(0, 160)}`)
if (missingMain.length) console.log('missing main cards:', missingMain.join(','))
