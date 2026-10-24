#!/usr/bin/env node
// 万象无终（TCU）P10 全卡逐卡验收账本 —— 377 条印刷记录（343 主卡 + 34 关联面）。
//
//   node tools/audit-tcu-all-cards.mjs --write    实跑并写入 audit/tcu-all-card-acceptance.json + src/cards/tcu-campaign-acceptance.js
//   node tools/audit-tcu-all-cards.mjs [--check]  默认：实跑后逐字节比对两份生成物（不一致即非零退出）
//
// 证据规则（docs/tcu-migration-roadmap.md §8.3）：
// - 逐卡证据只能来自**实跑的测试**：spawnSync 执行 6 个测试文件，用 tools/core-test-reporter.mjs
//   读 test:pass/test:fail 事件；不读源码字符串、不读冻结 JSON 猜结论。
// - 战役 237 + 关联面 34：证据名必须匹配 `TCU <code> 已验收|待实现 · ...`（逐卡 test）。
// - 玩家 87：证据名必须匹配 `TCU <code> ...`（4 个 M2 分片，117 例）。
// - 调查员 19：M1 的 43 例按调查员/专属卡命名、不带 TCU 前缀；按 manifest 的 verified 函数
//   做文件级证据归集（整个测试文件实跑通过 + profile id），与 Carcosa 的全卡账本口径一致。
// - 账本状态（verified/pending）由测试名标签决定；人工行为审计的近似说明只从
//   content/campaigns/theCircleUndone/card-acceptance.js 的 TCU_CARD_ACCEPTANCE_NOTES 读取，
//   未登记默认 verified，不在工具里硬编码任何卡的 pending。
// - 生成物两份：JSON 账本（人读/审计用）与 JS 模块（运行时读 verified/pending 集合与 summary）。
//   两份都由本工具生成，`--write` 后必须再跑一次默认 check 验证逐字节一致。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  CAMPAIGN_CARD_CODES,
} from '../content/packs/tcuCampaign/manifest.js'
import {
  tcuInvestigatorCardVerified,
  TCU_INVESTIGATOR_ACCEPTANCE_PROFILE,
} from '../content/packs/tcuInvestigators/manifest.js'
import {
  tcuPlayerCardVerified,
  TCU_PLAYER_ACCEPTANCE_PROFILE,
} from '../src/cards/tcu-player-acceptance.js'
import {
  TCU_PLAYER_BUILDABLE_CODES,
} from '../content/packs/tcuPlayer/manifest.js'
import { TCU_PACKS } from '../content/campaigns/theCircleUndone/card-data.js'
import { TCU_CARD_ACCEPTANCE_NOTES } from '../content/campaigns/theCircleUndone/card-acceptance.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
const files = [
  `${game}/tests/tcu-investigators.test.mjs`,
  `${game}/tests/tcu-player-m2-1.test.mjs`,
  `${game}/tests/tcu-player-m2-2.test.mjs`,
  `${game}/tests/tcu-player-m2-3.test.mjs`,
  `${game}/tests/tcu-player-m2-4.test.mjs`,
  `${game}/tests/tcu-campaign-card-acceptance.test.mjs`,
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const home = path.join(root, 'artifacts/tcu-all-cards/audit-home')
fs.mkdirSync(home, { recursive: true })

// 从 node --test 内部再 spawn node --test 时，继承的 NODE_TEST_CONTEXT 会让子进程走测试子进程模式，
// 不输出完整事件流；删除后 6 个文件在同一个普通子进程里跑，结果与直接执行一致。
const testEnv = { ...process.env, DSH_HOME: home }
delete testEnv.NODE_TEST_CONTEXT
const run = spawnSync(process.execPath, [
  '--test',
  `--test-reporter=./${game}/tools/core-test-reporter.mjs`,
  ...files,
], {
  cwd: root,
  env: testEnv,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
const resultsPath = 'artifacts/tcu-all-cards/all-card-acceptance-results.json'
fs.mkdirSync(path.dirname(path.join(root, resultsPath)), { recursive: true })
fs.writeFileSync(path.join(root, resultsPath), `${JSON.stringify(results, null, 2)}\n`)
if (run.status !== 0 || !results.length || results.some(result =>
  result.type !== 'test:pass' || result.skipped || result.todo)) {
  console.error(results.filter(result =>
    result.type !== 'test:pass' || result.skipped || result.todo), run.stderr)
  process.exit(1)
}
const relativeFile = result => path.relative(root, result.file).replaceAll('\\', '/')
const ranFiles = new Set(results.map(relativeFile))
for (const file of files) if (!ranFiles.has(file)) throw new Error(`测试没有产出用例：${file}`)

// ---------------------------------------------------------------------------
// 377 条记录范围：343 主卡（战役 237 / 调查员 19 / 玩家 87）+ 34 关联面
// ---------------------------------------------------------------------------
const tcuCards = Object.values(ALL_CARDS)
  .filter(card => TCU_PACKS.has(card.pack) && /^05\d{3}[a-z]?$/.test(card.code))
const mainCards = tcuCards
  .filter(card => /^05\d{3}$/.test(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))
const faceCards = tcuCards
  .filter(card => /^05\d{3}[a-z]$/.test(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))
if (mainCards.length !== 343) throw new Error(`Unexpected TCU main-card scope: ${mainCards.length}`)
if (faceCards.length !== 34) throw new Error(`Unexpected TCU face scope: ${faceCards.length}`)
const campaignCodes = new Set(CAMPAIGN_CARD_CODES)
if (campaignCodes.size !== 237) throw new Error(`Unexpected TCU campaign scope: ${campaignCodes.size}`)

// ---------------------------------------------------------------------------
// 依据实跑事件建立逐卡证据索引
// ---------------------------------------------------------------------------
const campaignResultPattern = /^TCU (05\d{3}[a-z]?) (已验收|待实现) · (.+)$/
const playerResultPattern = /^TCU (05\d{3}) /
const campaignByCode = new Map()
const playerByCode = new Map()
for (const result of results) {
  const campaignMatch = result.name.match(campaignResultPattern)
  if (campaignMatch) {
    const [, code, label, title] = campaignMatch
    if (campaignByCode.has(code)) throw new Error(`重复的战役卡证据：${code}`)
    campaignByCode.set(code, { status: label === '已验收' ? 'verified' : 'pending', title, result })
    continue
  }
  const playerMatch = result.name.match(playerResultPattern)
  if (playerMatch) {
    const code = playerMatch[1]
    playerByCode.set(code, [...(playerByCode.get(code) || []), result])
  }
}
const expectedCampaignEvidence = 237 + 34
if (campaignByCode.size !== expectedCampaignEvidence) {
  throw new Error(`战役卡/关联面证据不完整：${campaignByCode.size}/${expectedCampaignEvidence}`)
}
const investigatorResults = results.filter(result => relativeFile(result) === files[0])
if (investigatorResults.length !== 43) {
  throw new Error(`M1 调查员逐人验收用例数异常：${investigatorResults.length}`)
}

const noteFor = code => {
  const registered = TCU_CARD_ACCEPTANCE_NOTES[code]
  if (!registered) return { note: null, noteStatus: 'verified' }
  if (!['verified', 'simplified'].includes(registered.status)) {
    throw new Error(`逐卡备注状态非法：${code} → ${registered.status}`)
  }
  if (registered.status === 'simplified' && !registered.note) {
    throw new Error(`simplified 备注必须写明近似口径：${code}`)
  }
  return { note: registered.note || null, noteStatus: registered.status }
}

function evidenceOf(result) {
  return { file: relativeFile(result), line: result.line ?? null, test: result.name }
}

const entries = []
for (const card of mainCards) {
  const partitions = [
    tcuInvestigatorCardVerified(card.code) ? 'investigator' : null,
    tcuPlayerCardVerified(card.code) ? 'player' : null,
    campaignCodes.has(card.code) ? 'campaign' : null,
  ].filter(Boolean)
  if (partitions.length !== 1) {
    throw new Error(`主卡分区不唯一：${card.code} → ${partitions.join(',') || '(none)'}`)
  }
  const partition = partitions[0]
  let evidence
  let status
  if (partition === 'investigator') {
    status = 'verified'
    evidence = [{
      file: files[0],
      profile: TCU_INVESTIGATOR_ACCEPTANCE_PROFILE.id,
      tests: investigatorResults.length,
      scope: 'M1 逐人验收（文件级证据：whole-file 实跑通过）',
    }]
  } else if (partition === 'player') {
    const titles = playerByCode.get(card.code) || []
    if (!titles.length) throw new Error(`玩家卡缺少 TCU <code> 逐卡证据：${card.code}`)
    status = 'verified'
    evidence = titles.map(evidenceOf)
  } else {
    const assessment = campaignByCode.get(card.code)
    if (!assessment) throw new Error(`战役卡缺少逐卡验收评估：${card.code}`)
    status = assessment.status
    evidence = [evidenceOf(assessment.result)]
  }
  const { note, noteStatus } = noteFor(card.code)
  entries.push({
    code: card.code,
    name: card.nameZh || card.name,
    type: card.type,
    pack: card.pack,
    partition,
    status,
    note,
    noteStatus,
    evidence,
  })
}
for (const card of faceCards) {
  const assessment = campaignByCode.get(card.code)
  if (!assessment) throw new Error(`关联面缺少逐卡验收评估：${card.code}`)
  const printed = ALL_CARDS[card.code]
  const reverseLink = Object.values(ALL_CARDS)
    .find(other => other.linkedCardCode === card.code)?.code || null
  const linked = printed.linkedCardCode || printed.linkedToCode || reverseLink
  const { note, noteStatus } = noteFor(card.code)
  entries.push({
    code: card.code,
    name: card.nameZh || card.name,
    type: card.type,
    pack: card.pack,
    partition: 'face',
    status: assessment.status,
    linkedTo: linked,
    note: note ?? assessment.title,
    noteStatus,
    evidence: [evidenceOf(assessment.result)],
  })
}
if (entries.length !== 377) throw new Error(`Unexpected TCU all-card ledger scope: ${entries.length}`)
const unknownNotes = Object.keys(TCU_CARD_ACCEPTANCE_NOTES)
  .filter(code => !entries.some(entry => entry.code === code))
if (unknownNotes.length) throw new Error(`逐卡备注登记了不存在/越界的卡：${unknownNotes.join(', ')}`)

// ---------------------------------------------------------------------------
// 账本、summary、生成模块
// ---------------------------------------------------------------------------
// 玩家卡两套口径（P10 开放关卡后仍然分开记账，两个数字都可由卡面数据独立复算）：
//   constructible = 包清单口径 85 张（87 已验收 - 2 基础弱点，含 05314/05317 两个 deckLimit=0 的绑定副本）；
//   deckable      = 入牌组口径 83 张（可构筑 85 张里去掉 deckLimit=0 的 2 张绑定副本）。
// 05314/05317 已经逐卡验收，只是不在起始牌组里：账本状态仍是 verified，绝不标记 pending。
const deckLimitOf = card => card?.deckLimit ?? 2
const constructibleCodes = [...TCU_PLAYER_BUILDABLE_CODES]
const deckableCodes = constructibleCodes.filter(code => deckLimitOf(ALL_CARDS[code]) > 0)
const constructible = constructibleCodes.length
const deckable = deckableCodes.length
if (constructible !== 85) throw new Error(`Unexpected TCU constructible count: ${constructible}`)
if (deckable !== 83) throw new Error(`Unexpected TCU deckable count: ${deckable}`)

const profile = {
  id: 'original-circle-undone-all-cards-2026-10',
  scope: '万象无终原始循环 377 条印刷记录：343 张主卡（战役 237 / 调查员 19 / 玩家 87）与 34 个关联面（05xxxa/b/c…）。',
  basis: '逐卡运行测试：237 张战役主卡的卡面印刷数据与 9 章 definition/behavior 逐字段对照（tests/tcu-campaign-card-acceptance.test.mjs 275 例）、87 张玩家卡 4 个分片（tests/tcu-player-m2-{1..4}.test.mjs 123 例）、19 张调查员/专属卡 M1 逐人验收（tests/tcu-investigators.test.mjs 43 例）；证据只从实跑 node --test 的 test:pass 事件归集。',
  partitionPolicy: '主卡按 content/packs/tcu*/manifest.js 的 verified 函数切成 investigator/player/campaign 三分区且唯一；34 个关联面不是独立主卡，按 linkedCardCode/linkedToCode 归到主卡或成对关联面，账本 partition 记 face，证据取主卡定义/行为链接（逐面 test）。',
  pendingPolicy: '目录存在、卡号被源码引用、rulesPending:false 或文本非空都不构成通过；未被逐卡 test 标记「已验收」的卡保持 pending 并计入 summary.pending。',
  notePolicy: '人工行为审计的近似实现说明登记在 content/campaigns/theCircleUndone/card-acceptance.js 的 TCU_CARD_ACCEPTANCE_NOTES；未登记默认 verified。',
  playerCardPolicy: `玩家 87 张全部逐卡 verified；其中 constructible=${constructible}（包清单口径：87 已验收 - 2 基础弱点，含 05314/05317 两个 deckLimit=0 的绑定副本），deckable=${deckable}（入牌组口径：05 开放池去掉 2 个绑定副本）。绑定副本只是场外检索卡，不进起始牌组，也不因此降级为 pending。`,
  inheritedProfiles: [
    TCU_INVESTIGATOR_ACCEPTANCE_PROFILE.id,
    TCU_PLAYER_ACCEPTANCE_PROFILE.id,
  ],
  sources: [
    'src/cards/cards-data.js',
    'content/campaigns/theCircleUndone/card-data.js',
    'content/campaigns/theCircleUndone/scenarios/<9 章>/{definition,behavior}.js',
    '参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json',
  ],
}
const summary = {
  total: entries.length,
  verified: entries.filter(entry => entry.status === 'verified').length,
  pending: entries.filter(entry => entry.status === 'pending').length,
  investigator: entries.filter(entry => entry.partition === 'investigator').length,
  player: entries.filter(entry => entry.partition === 'player').length,
  campaign: entries.filter(entry => entry.partition === 'campaign').length,
  face: entries.filter(entry => entry.partition === 'face').length,
  constructible,
  deckable,
  simplified: entries.filter(entry => entry.noteStatus === 'simplified').length,
  testsPassed: results.length,
  testFiles: files.length,
}
const expectedCounts = { total: 377, investigator: 19, player: 87, campaign: 237, face: 34 }
for (const [key, expected] of Object.entries(expectedCounts)) {
  if (summary[key] !== expected) throw new Error(`Unexpected ledger ${key}: ${summary[key]}`)
}
if (summary.verified + summary.pending !== summary.total) throw new Error('verified/pending 与 total 对账失败')
// 玩家 87 = 85 可构筑（含 2 张绑定副本）+ 2 张基础弱点；绑定副本必须仍是 verified，不能因 deckLimit=0 记 pending。
if (constructible !== summary.player - 2) throw new Error('constructible 与玩家分区对账失败')
const deckableCodesSet = new Set(deckableCodes)
for (const code of ['05314', '05317']) {
  const entry = entries.find(candidate => candidate.code === code)
  if (!entry || entry.status !== 'verified') throw new Error(`绑定副本必须是已验收：${code}`)
  if (!constructibleCodes.includes(code) || deckableCodesSet.has(code)) {
    throw new Error(`绑定副本口径错误（应 constructible 但不可 deckable）：${code}`)
  }
}

const ledger = {
  schemaVersion: 1,
  generatedBy: 'tools/audit-tcu-all-cards.mjs',
  profile,
  summary,
  testFiles: files.map(file => ({
    file,
    sha256: hash(fs.readFileSync(path.join(root, file))),
  })),
  entries,
}
const json = `${JSON.stringify(ledger, null, 2)}\n`
const campaignVerified = entries
  .filter(entry => entry.partition === 'campaign' && entry.status === 'verified')
  .map(entry => entry.code)
const campaignPending = entries
  .filter(entry => entry.partition === 'campaign' && entry.status === 'pending')
  .map(entry => entry.code)
const allVerified = entries.filter(entry => entry.status === 'verified').map(entry => entry.code)
const module = `// Generated by tools/audit-tcu-all-cards.mjs after executing TCU all-card acceptance tests.
// Detailed evidence: audit/tcu-all-card-acceptance.json.
export const TCU_ALL_CARD_ACCEPTANCE_PROFILE = ${JSON.stringify(profile, null, 2)}
export const TCU_ALL_CARD_ACCEPTANCE_SHA256 = '${hash(json)}'
export const TCU_CAMPAIGN_VERIFIED_CODES = Object.freeze(${JSON.stringify(campaignVerified)})
export const TCU_CAMPAIGN_PENDING_CODES = Object.freeze(${JSON.stringify(campaignPending)})
export const TCU_ALL_CARD_VERIFIED_CODES = Object.freeze(${JSON.stringify(allVerified)})
export const tcuAllCardAcceptance = Object.freeze(${JSON.stringify(summary)})
const campaignVerifiedSet = new Set(TCU_CAMPAIGN_VERIFIED_CODES)
const campaignPendingSet = new Set(TCU_CAMPAIGN_PENDING_CODES)
export const tcuCampaignCardVerified = code => campaignVerifiedSet.has(code)
export const tcuCampaignCardPending = code => campaignPendingSet.has(code)
export const tcuAllCardVerified = code => TCU_ALL_CARD_VERIFIED_CODES.includes(code)
`
for (const [file, text] of [
  ['audit/tcu-all-card-acceptance.json', json],
  ['src/cards/tcu-campaign-acceptance.js', module],
]) {
  const destination = path.join(root, game, file)
  if (process.argv.includes('--write')) fs.writeFileSync(destination, text)
  else if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) {
    throw new Error(`Acceptance artifact stale: ${file}`)
  }
}
console.log(JSON.stringify(summary))
