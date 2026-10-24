// P10 逐卡行为审计：把 343 张主卡按「章节/共享组/玩家波次/调查员」切成可审计批次。
// 输出 artifacts/tcu-audit/batches.json（artifacts 已 gitignore）。只读内容层，不写内容文件。
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const { contentRegistry } = await import(new URL('../content/registered.js', import.meta.url))
const { chapters } = await import(new URL('../content/campaigns/theCircleUndone/shared.js', import.meta.url))
const { ALL_CARDS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))

const codeOf = definition => definition?.originalCode || definition?.code || null
const pushCode = (set, code) => { if (code && ALL_CARDS[code] && /^05\d{3}$/.test(code)) set.add(code) }

const chapterCodes = new Map()
const sharedCount = new Map()
for (const chapter of chapters) {
  const data = contentRegistry.getScenarioData(chapter.id)
  const codes = new Set()
  pushCode(codes, chapter.code)
  for (const location of Object.values(data.locations || {})) {
    for (const code of [location.frontCode, location.backCode, location.originalCode, location.code]) pushCode(codes, code)
    // 双面/幽灵地点的背面身份可能只出现在 backFace 里。
    for (const face of Object.values(location.back || {})) pushCode(codes, codeOf(face))
    pushCode(codes, codeOf(location.back))
  }
  for (const group of ['acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    for (const definition of Object.values(data[group] || {})) pushCode(codes, codeOf(definition))
  }
  for (const code of data.encounterDeck || []) pushCode(codes, code)
  for (const code of codes) sharedCount.set(code, (sharedCount.get(code) || 0) + 1)
  chapterCodes.set(chapter.id, codes)
}

// 只出现在一章的卡归该章；跨章出现（共享遭遇组）单独归一个「共享组」审计批次。
const batches = []
const shared = new Set()
for (const [chapterId, codes] of chapterCodes) {
  const own = [...codes].filter(code => sharedCount.get(code) === 1).sort()
  for (const code of codes) if (sharedCount.get(code) > 1) shared.add(code)
  if (own.length) batches.push({ id: `chapter:${chapterId}`, kind: 'chapter', chapterId, codes: own })
}
if (shared.size) batches.push({ id: 'shared:encounters', kind: 'shared', codes: [...shared].sort() })

// 调查员侧 19 张（6 位正式 + 13 张专属/弱点），故事调查员单列。
const storyCodes = ['05046', '05047', '05048', '05049']
const investigatorCodes = Object.values(ALL_CARDS)
  .filter(card => /^05\d{3}$/.test(card.code) && (card.type === 'investigator' || card.signatureFor))
  .map(card => card.code).filter(code => !storyCodes.includes(code)).sort()
batches.push({ id: 'investigators', kind: 'investigator', codes: investigatorCodes })

// 玩家卡 87 张按 4 波（与 M2 分片一致，便于对照逐卡测试文件）。
const playerWaves = [
  ['m2-1', ['05020', '05041']],
  ['m2-2', ['05042', '05160']],
  ['m2-3', ['05186', '05274']],
  ['m2-4', ['05275', '05324']],
]
const playerCodes = Object.values(ALL_CARDS)
  .filter(card => /^05\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator'
    && (['asset', 'event', 'skill'].includes(card.type) || ['weakness', 'basicweakness'].includes(card.subtype)))
  .map(card => card.code).sort()
for (const [wave, [from, to]] of playerWaves) {
  const codes = playerCodes.filter(code => code >= from && code <= to)
  batches.push({ id: `player:${wave}`, kind: 'player', testFile: `tests/tcu-player-${wave}.test.mjs`, codes })
}
// 故事调查员 4 张（无牌组，但卡面能力有实现）。
batches.push({ id: 'story-investigators', kind: 'story-investigator', codes: storyCodes })

// 收口：任何尚未进入章节/共享/调查员/玩家批次的 05 主卡（setAside、参考卡、变体等）。
const assigned = new Set(batches.flatMap(batch => batch.codes))
const unassigned = Object.values(ALL_CARDS)
  .filter(card => /^05\d{3}$/.test(card.code) && !assigned.has(card.code))
  .map(card => card.code).sort()
if (unassigned.length) batches.push({ id: 'campaign:other', kind: 'campaign-other', codes: unassigned })

const output = {
  generatedFor: 'P10 逐卡行为审计（印刷描述 vs 实现）',
  totalMainCards: [...new Set(batches.flatMap(batch => batch.codes))].length,
  batches,
}
// 单批不超过 16 张：每个审计 agent 都要逐条核对卡面文本，批次太大容易漏。
const split = []
for (const batch of batches) {
  if (batch.codes.length <= 16) {
    split.push(batch)
    continue
  }
  const chunks = Math.ceil(batch.codes.length / 16)
  for (let index = 0; index < chunks; index += 1) {
    split.push({ ...batch, id: `${batch.id}#${index + 1}`, codes: batch.codes.slice(index * 16, (index + 1) * 16) })
  }
}
output.batches = split
mkdirSync(new URL('artifacts/tcu-audit/', root), { recursive: true })
writeFileSync(new URL('artifacts/tcu-audit/batches.json', root), `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify(output.batches.map(batch => ({ id: batch.id, cards: batch.codes.length })), null, 1))
console.log('distinct cards:', output.totalMainCards)
