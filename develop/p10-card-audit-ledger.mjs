// P10 逐卡行为审计账本生成器（一次性汇总产物生成）：
//   node develop/p10-card-audit-ledger.mjs --write
// 读取 artifacts/tcu-audit/results/*.json（AI 审计逐批结果，artifacts 不入库）+
// 34 个关联面按主卡结论继承，生成 audit/tcu-card-behavior-audit.json（入库的证据账本）。
// 账本只记录「人工/代理逐卡核对」的结论与证据摘要，不冒充自动测试：自动测试证据在
// audit/tcu-all-card-acceptance.json 与 src/cards/tcu-campaign-acceptance.js。
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const { ALL_CARDS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))
const resultsDir = new URL('../artifacts/tcu-audit/results/', import.meta.url)
const files = existsSync(resultsDir) ? readdirSync(resultsDir).filter(file => file.endsWith('.json')).sort() : []
if (!files.length) throw new Error('缺少 artifacts/tcu-audit/results/*.json：先跑 P10 逐卡行为审计批次')
const batches = files.map(file => JSON.parse(readFileSync(new URL(file, resultsDir), 'utf8')))
const cards = new Map()
for (const batch of batches) {
  for (const card of batch.cards || []) {
    if (!/^05\d{3}[a-z]?$/.test(card.code)) continue
    if (!cards.has(card.code)) cards.set(card.code, { ...card, batch: batch.batch })
  }
}

const partitionOf = batch => {
  if (!batch) return 'campaign'
  if (batch.startsWith('player:')) return 'player'
  if (batch.startsWith('investigator')) return 'investigator'
  if (batch.startsWith('story-investigator')) return 'campaign'
  return 'campaign'
}

const faces = Object.keys(ALL_CARDS).filter(code => /^05\d{3}[a-z]$/.test(code)).sort()
const faceEntries = faces.map(code => {
  const face = ALL_CARDS[code]
  const direct = cards.get(code) || null
  if (direct) {
    // 12 张异端者两面在批次里作为独立卡审计过，直接用它的逐条核对结果。
    return {
      code,
      name: direct.name || face.nameZh || face.name,
      partition: 'face',
      verdict: direct.verdict,
      note: direct.verdict === 'match' ? null : String(direct.note || '').slice(0, 1600),
      clauses: (direct.clauses || [])
        .filter(clause => clause.status !== 'implemented')
        .map(clause => ({ text: String(clause.text || '').slice(0, 160), status: clause.status, evidence: String(clause.evidence || '').slice(0, 240) })),
      batch: direct.batch,
    }
  }
  const linked = face.linkedCardCode || face.linkedToCode || null
  const mainCode = /^05\d{3}$/.test(String(linked || '')) ? linked : null
  const main = mainCode ? cards.get(mainCode) : null
  return {
    code,
    name: face.nameZh || face.name,
    partition: 'face',
    verdict: main ? main.verdict : 'gap',
    note: main
      ? `关联面：行为随主卡 ${mainCode}（${main.name}）的翻面/结算一并核对；主卡审计结论 ${main.verdict}。`
      : '关联面：未找到已审计主卡，待人工复核。',
    clauses: [],
    inheritedFrom: mainCode,
    batch: main?.batch || null,
  }
})

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code)).sort()
const missingMain = mainCodes.filter(code => !cards.has(code))
if (missingMain.length) throw new Error(`逐卡行为审计未覆盖这些主卡：${missingMain.join(',')}`)
const entries = mainCodes.map(code => {
  const card = cards.get(code)
  const clauses = (card.clauses || [])
    .filter(clause => clause.status !== 'implemented' || card.verdict === 'match')
    .map(clause => ({ text: String(clause.text || '').slice(0, 160), status: clause.status, evidence: String(clause.evidence || '').slice(0, 240) }))
  return {
    code,
    name: card.name || ALL_CARDS[code].nameZh || ALL_CARDS[code].name,
    partition: partitionOf(card.batch),
    verdict: card.verdict,
    note: card.verdict === 'match' ? null : String(card.note || '').slice(0, 1600),
    clauses: card.verdict === 'match' ? [] : clauses,
    batch: card.batch,
  }
})
const allEntries = [...entries, ...faceEntries]
const count = verdict => allEntries.filter(entry => entry.verdict === verdict).length
const summary = {
  mainCards: entries.length,
  faces: faceEntries.length,
  total: allEntries.length,
  covered: allEntries.length,
  match: count('match'),
  approximation: count('approximation'),
  gap: count('gap'),
  notApplicable: count('not-applicable'),
  faceInherited: faceEntries.length,
  batches: batches.map(batch => batch.batch).sort(),
}
const ledger = {
  schemaVersion: 1,
  campaignId: 'theCircleUndone',
  milestone: 'P10',
  generatedBy: 'develop/p10-card-audit-ledger.mjs（P10 逐卡行为审计汇总）',
  method: '每张 05 主卡（含 34 个关联面）对照卡面印刷文本与实现逐条核对：实现证据给到文件/函数，'
    + '近似实现与未实现子句逐条记录；关联面按主卡翻面/结算逻辑继承结论。'
    + '该账本记录的是行为审计结论，自动测试证据在 audit/tcu-all-card-acceptance.json；'
    + '任何 gap/approximation 都进 audit/tcu-migration.json 的 remaining，不宣称规则等价。',
  summary,
  entries: allEntries,
}
const json = `${JSON.stringify(ledger, null, 1)}\n`
const target = new URL('../audit/tcu-card-behavior-audit.json', import.meta.url)
if (process.argv.includes('--write')) writeFileSync(target, json)
else if (!existsSync(target) || readFileSync(target, 'utf8') !== json) {
  throw new Error('audit/tcu-card-behavior-audit.json 与审计结果不一致：重新 --write')
}
console.log(JSON.stringify(summary))
