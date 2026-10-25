// 逐卡行为审计账本生成器（2026-10-25 第二轮：全量重审）：
//   node develop/p10-card-audit-ledger.mjs --write
//   node develop/p10-card-audit-ledger.mjs          （--check 语义：生成物必须与审计结果逐字节一致）
// 读取 artifacts/tcu-audit/results/*.json（审计 agent 逐批结果，artifacts 不入库）
// + 34 个关联面（本轮直接审计；缺失时按主卡结论继承，仅为兜底），
// 生成 audit/tcu-card-behavior-audit.json（入库的证据账本）。
//
// 判据（见 artifacts/tcu-audit/REAUDIT-BRIEF.md）：
//   match         全部子句 implemented → 通过，登记为已验收（accepted=true）；
//   approximation 有已知偏差但无 missing 子句 → 不通过（显式近似）；
//   gap           有 missing 子句 → 不通过（未实现子句）。
// 账本只记录「人工/代理逐卡核对」的结论与证据摘要，不冒充自动测试：自动测试证据在
// audit/tcu-all-card-acceptance.json 与 src/cards/tcu-campaign-acceptance.js。
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const { ALL_CARDS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))
const resultsDir = new URL('../artifacts/tcu-audit/results/', import.meta.url)
const files = existsSync(resultsDir) ? readdirSync(resultsDir).filter(file => file.endsWith('.json') && !file.startsWith('.')).sort() : []
if (!files.length) throw new Error('缺少 artifacts/tcu-audit/results/*.json：先跑逐卡行为审计批次')
const batches = files.map(file => JSON.parse(readFileSync(new URL(file, resultsDir), 'utf8')))
const cards = new Map()
for (const batch of batches) {
  for (const card of batch.cards || []) {
    if (!/^05\d{3}[a-z]?$/.test(card.code)) continue
    if (cards.has(card.code)) throw new Error(`卡号在多个批次重复审计：${card.code}`)
    cards.set(card.code, { ...card, batch: batch.batch })
  }
}

const TRUNCATE = { text: 200, evidence: 400, note: 1800 }
const clauseOf = clause => ({
  text: String(clause.text || '').slice(0, TRUNCATE.text),
  status: clause.status,
  evidence: String(clause.evidence || '').slice(0, TRUNCATE.evidence),
})
const acceptedOf = verdict => verdict === 'match'

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
    // 34 个关联面本轮作为独立卡直接审计。
    return {
      code,
      name: direct.name || face.nameZh || face.name,
      partition: 'face',
      verdict: direct.verdict,
      accepted: acceptedOf(direct.verdict),
      note: acceptedOf(direct.verdict) ? null : String(direct.note || '').slice(0, TRUNCATE.note),
      clauses: acceptedOf(direct.verdict) ? (direct.clauses || []).map(clauseOf) : (direct.clauses || [])
        .filter(clause => clause.status !== 'implemented')
        .map(clauseOf),
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
    accepted: main ? acceptedOf(main.verdict) : false,
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
  const accepted = acceptedOf(card.verdict)
  const clauses = (card.clauses || [])
    .filter(clause => clause.status !== 'implemented' || accepted)
    .map(clauseOf)
  return {
    code,
    name: card.name || ALL_CARDS[code].nameZh || ALL_CARDS[code].name,
    partition: partitionOf(card.batch),
    verdict: card.verdict,
    accepted,
    note: accepted ? null : String(card.note || '').slice(0, TRUNCATE.note),
    clauses: accepted ? clauses : clauses.filter(clause => clause.status !== 'implemented'),
    batch: card.batch,
  }
})
const allEntries = [...entries, ...faceEntries]
const count = verdict => allEntries.filter(entry => entry.verdict === verdict).length
const acceptedEntries = allEntries.filter(entry => entry.accepted)
const failedEntries = allEntries.filter(entry => !entry.accepted)
const summary = {
  mainCards: entries.length,
  faces: faceEntries.length,
  total: allEntries.length,
  covered: allEntries.length,
  match: count('match'),
  accepted: acceptedEntries.length,
  acceptedMainCards: acceptedEntries.filter(entry => entry.partition !== 'face').length,
  acceptedFaces: acceptedEntries.filter(entry => entry.partition === 'face').length,
  approximation: count('approximation'),
  gap: count('gap'),
  notApplicable: count('not-applicable'),
  failed: failedEntries.length,
  failedMainCards: failedEntries.filter(entry => entry.partition !== 'face').length,
  failedFaces: failedEntries.filter(entry => entry.partition === 'face').length,
  acceptedCodes: acceptedEntries.map(entry => entry.code).sort(),
  failedCodes: failedEntries.map(entry => entry.code).sort(),
  faceDirect: faceEntries.filter(entry => !entry.inheritedFrom).length,
  faceInherited: faceEntries.filter(entry => entry.inheritedFrom).length,
  batches: batches.map(batch => batch.batch).sort(),
}
const ledger = {
  schemaVersion: 2,
  campaignId: 'theCircleUndone',
  milestone: 'P10',
  round: '2026-10-25-reaudit-2（修复战役后全量重跑）',
  generatedBy: 'develop/p10-card-audit-ledger.mjs（逐卡行为审计第二轮汇总）',
  method: '每张 05 主卡（含 34 个关联面）对照卡面印刷文本与当前 HEAD（2276b97）实现逐条核对：'
    + '每个印刷子句给 implemented / approximation / missing 与 file:line 证据；'
    + 'match（全部子句 implemented）判定为「通过」并登记为已验收（accepted=true），'
    + 'approximation（有显式偏差）与 gap（有未实现子句）不列入已验收，逐条记录差异；'
    + '关联面本轮全部直接审计。该账本记录的是行为审计结论，自动测试证据在 '
    + 'audit/tcu-all-card-acceptance.json；任何 gap/approximation 都进 audit/tcu-migration.json 的 remaining，'
    + '不宣称规则等价。',
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
