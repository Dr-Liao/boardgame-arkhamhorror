#!/usr/bin/env node
// 食梦者（The Dream Eaters）P9 全卡逐卡验收账本 —— 388 条印刷记录（352 主卡 + 36 关联面）。
//
//   node tools/audit-tde-all-cards.mjs --write    实跑并写入 audit/tde-all-card-acceptance.json + src/cards/tde-campaign-acceptance.js
//   node tools/audit-tde-all-cards.mjs [--check]  默认：实跑后逐字节比对两份生成物（不一致即非零退出）
//
// 证据规则（docs/tde-migration-roadmap.md §8.3 / §11.2、docs/arkham-content-migration.md §5.2）：
// - 逐卡证据只能来自**实跑的测试**：spawnSync 执行 6 个测试文件，用 tools/core-test-reporter.mjs
//   读 test:pass/test:fail 事件；不读源码字符串、不读冻结 JSON 猜结论。
// - 战役 283（249 主卡 + 34 关联面）：证据名必须匹配 `TDE <code> 已验收|待实现 · ...`（逐卡 test，
//   tests/tde-campaign-card-acceptance.test.mjs）。
// - 玩家 87：证据名必须匹配 `TDE <code> ...`（4 个 M2 分片）。
// - 调查员 18（16 主卡 + 2 关联面 06015a/b）：文件级证据（whole-file 实跑通过 + 包 manifest 的
//   TDE_INVESTIGATOR_ACCEPTANCE_PROFILE），与 TCU 的调查员口径一致。
// - 账本状态（verified/pending）由测试名标签 / manifest verified 函数决定；人工行为审计的近似说明只从
//   content/campaigns/theDreamEaters/card-acceptance.js 的 TDE_CARD_ACCEPTANCE_NOTES 读取，
//   未登记默认 verified，不在工具里硬编码任何卡的 pending。
// - simplified 是「已登记显式简化」：P7 玩家 53 + P8 单卡 22 + P8 章节 gap 12→8 锚点 = 83；
//   gap 的逐条评审在 audit/tde-scenario-gap-triage.json，note 与 gapRefs 只从该文件与注册表读取。
// - 生成物两份：JSON 账本（人读/审计用）与 JS 模块（运行时读 verified/pending 集合与 summary）。
//   两份都由本工具生成，`--write` 后必须再跑一次默认 check 验证逐字节一致。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
import { implementedFor } from '../src/cards/card-rules.js'
import {
  CAMPAIGN_CARD_CODES, CAMPAIGN_FACE_CODES,
} from '../content/packs/tdeCampaign/manifest.js'
import {
  INVESTIGATOR_CARD_CODES, UNOWNED_FACE_OVERRIDES,
  TDE_INVESTIGATOR_ACCEPTANCE_PROFILE, tdeInvestigatorCardVerified,
} from '../content/packs/tdeInvestigators/manifest.js'
import {
  PLAYER_CARD_CODES, TDE_PLAYER_BUILDABLE_CODES, TDE_PLAYER_DEPENDENCY_CODES,
  TDE_PLAYER_BASIC_WEAKNESS_CODES,
} from '../content/packs/tdePlayer/manifest.js'
import {
  tdePlayerCardVerified, TDE_PLAYER_ACCEPTANCE_PROFILE,
} from '../src/cards/tde-player-acceptance.js'
import { TDE_PACKS, tdeCards } from '../content/campaigns/theDreamEaters/card-data.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import {
  TDE_CARD_ACCEPTANCE_NOTES, TDE_SCENARIO_GAP_CARDS, TDE_SCENARIO_GAP_TRIAGE_FILE,
  TDE_P6_SIMPLIFICATION_CODES, TDE_NO_ENTRY_CODES, TDE_NO_ENTRY_REASONS,
} from '../content/campaigns/theDreamEaters/card-acceptance.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
const files = [
  `${game}/tests/tde-investigators.test.mjs`,
  `${game}/tests/tde-player-m2-1.test.mjs`,
  `${game}/tests/tde-player-m2-2.test.mjs`,
  `${game}/tests/tde-player-m2-3.test.mjs`,
  `${game}/tests/tde-player-m2-4.test.mjs`,
  `${game}/tests/tde-campaign-card-acceptance.test.mjs`,
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const home = path.join(root, 'artifacts/tde-all-cards/audit-home')
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
const resultsPath = 'artifacts/tde-all-cards/all-card-acceptance-results.json'
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
// 388 条记录范围：352 主卡（战役 249 / 调查员 16 / 玩家 87）+ 36 关联面
// ---------------------------------------------------------------------------
const tde = tdeCards()
if (tde.length !== 388) throw new Error(`Unexpected TDE scope: ${tde.length}`)
const mainCards = tde
  .filter(card => /^06\d{3}$/.test(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))
const faceCards = tde
  .filter(card => /^06\d{3}[a-z]$/.test(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))
if (mainCards.length !== 352) throw new Error(`Unexpected TDE main-card scope: ${mainCards.length}`)
if (faceCards.length !== 36) throw new Error(`Unexpected TDE face scope: ${faceCards.length}`)
const campaignCodes = new Set(CAMPAIGN_CARD_CODES)
const campaignFaceCodes = new Set(CAMPAIGN_FACE_CODES)
const investigatorCodes = new Set(INVESTIGATOR_CARD_CODES)
const playerCodes = new Set(PLAYER_CARD_CODES)
const investigatorFaceCodes = new Set(Object.keys(UNOWNED_FACE_OVERRIDES)
  .filter(code => UNOWNED_FACE_OVERRIDES[code].pack === 'tdeInvestigators'))
if (campaignCodes.size !== 249) throw new Error(`Unexpected TDE campaign scope: ${campaignCodes.size}`)
if (campaignFaceCodes.size !== 34) throw new Error(`Unexpected TDE campaign face scope: ${campaignFaceCodes.size}`)
if (investigatorCodes.size !== 16) throw new Error(`Unexpected TDE investigator scope: ${investigatorCodes.size}`)
if (investigatorFaceCodes.size !== 2) throw new Error(`Unexpected TDE investigator face scope: ${investigatorFaceCodes.size}`)
if (playerCodes.size !== 87) throw new Error(`Unexpected TDE player scope: ${playerCodes.size}`)
const packOf = code => {
  if (campaignCodes.has(code) || campaignFaceCodes.has(code)) return 'tdeCampaign'
  if (investigatorCodes.has(code) || investigatorFaceCodes.has(code)) return 'tdeInvestigators'
  if (playerCodes.has(code)) return 'tdePlayer'
  throw new Error(`Unassigned TDE record: ${code}`)
}
const kindOf = code => (/^06\d{3}$/.test(code) ? 'main' : 'face')
for (const code of [...campaignCodes, ...investigatorCodes, ...playerCodes]) {
  const hits = [campaignCodes, investigatorCodes, playerCodes].filter(set => set.has(code)).length
  if (hits !== 1) throw new Error(`主卡包分区不唯一：${code} → ${hits}`)
}
for (const code of [...campaignFaceCodes, ...investigatorFaceCodes]) {
  const hits = [campaignFaceCodes, investigatorFaceCodes].filter(set => set.has(code)).length
  if (hits !== 1) throw new Error(`关联面包分区不唯一：${code} → ${hits}`)
}
for (const card of [...mainCards, ...faceCards]) {
  if (!TDE_PACKS.has(card.pack)) throw new Error(`食梦者记录不在食梦者 7 包内：${card.code} → ${card.pack}`)
}

// 章节模块：用于章节级 gap 映射与每张战役卡的章节归属（真实模块数据，不读源码文本）。
const chapterModules = {}
for (const chapter of chapters) {
  chapterModules[chapter.id] = await import(
    new URL(`../content/campaigns/theDreamEaters/scenarios/${chapter.id}/index.js`, import.meta.url))
}
function collectDefinitions(value, result = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) collectDefinitions(item, result, seen)
    return result
  }
  if (typeof value.originalCode === 'string') result.push(value)
  for (const item of Object.values(value)) collectDefinitions(item, result, seen)
  return result
}
const chaptersByCode = new Map()
for (const chapter of chapters) {
  const chapterModule = chapterModules[chapter.id]
  const codes = new Set(collectDefinitions(chapterModule.scenario).map(definition => definition.originalCode))
  for (const definition of collectDefinitions(chapterModule.scenario)) {
    for (const linked of [definition.linkedOriginalCode, definition.backCode, definition.storyCode]) {
      if (linked) codes.add(linked)
    }
  }
  for (const code of codes) {
    if (!chaptersByCode.has(code)) chaptersByCode.set(code, [])
    chaptersByCode.get(code).push(chapter.id)
  }
}

// ---------------------------------------------------------------------------
// 依据实跑事件建立逐卡证据索引
// ---------------------------------------------------------------------------
const campaignResultPattern = /^TDE (06\d{3}[a-z]?) (已验收|待实现) · (.+)$/
const playerResultPattern = /^TDE (06\d{3}) (?!已验收|待实现)/
const playerFiles = new Set(files.slice(1, 5))
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
  if (!playerFiles.has(relativeFile(result))) continue
  const playerMatch = result.name.match(playerResultPattern)
  if (!playerMatch) continue
  const code = playerMatch[1]
  playerByCode.set(code, [...(playerByCode.get(code) || []), result])
}
const expectedCampaignEvidence = campaignCodes.size + campaignFaceCodes.size
if (campaignByCode.size !== expectedCampaignEvidence) {
  throw new Error(`战役卡/关联面证据不完整：${campaignByCode.size}/${expectedCampaignEvidence}`)
}
for (const code of campaignByCode.keys()) {
  if (!campaignCodes.has(code) && !campaignFaceCodes.has(code)) {
    throw new Error(`战役逐卡证据出现越界卡号：${code}`)
  }
}
for (const code of [...campaignCodes, ...campaignFaceCodes]) {
  if (!campaignByCode.has(code)) throw new Error(`战役卡缺少逐卡验收评估：${code}`)
}
const investigatorResults = results.filter(result => relativeFile(result) === files[0])
if (investigatorResults.length < 25) {
  throw new Error(`M1 调查员逐人验收用例数异常：${investigatorResults.length}`)
}
for (const code of playerCodes) {
  if (!tdePlayerCardVerified(code)) throw new Error(`玩家卡未声明 verified：${code}`)
  const evidence = playerByCode.get(code) || []
  if (!evidence.length) throw new Error(`玩家卡缺少 TDE ${code} 逐卡证据`)
}

const noteFor = code => {
  const registered = TDE_CARD_ACCEPTANCE_NOTES[code]
  if (!registered) return { note: null, noteStatus: 'verified', noteSources: [], gapRefs: [] }
  if (!['verified', 'simplified'].includes(registered.status)) {
    throw new Error(`逐卡备注状态非法：${code} → ${registered.status}`)
  }
  if (registered.status === 'simplified' && !registered.note) {
    throw new Error(`simplified 备注必须写明近似口径：${code}`)
  }
  if (registered.status === 'simplified' && !(registered.sources || []).length) {
    throw new Error(`simplified 备注必须写明来源（P7/P8-card/P8-gap）：${code}`)
  }
  return {
    note: registered.note || null,
    noteStatus: registered.status,
    noteSources: [...(registered.sources || [])],
    gapRefs: [...(registered.gaps || [])],
  }
}

// ---------------------------------------------------------------------------
// 简化登记对账（不静默近似）：
//   1. P7 玩家包当前显式简化必须与注册表逐一对应（含 note 一致）；
//   2. P8 单卡条目 simplified===true 的 22 条必须全部登记 simplified，note 与条目一致；
//   3. P8 的 12 条 behavior.scenarioGaps 由 audit/tde-scenario-gap-triage.json 逐条落卡，
//      每条 gap 原文必须与章节 behavior.scenarioGaps[index] 一致，锚点卡必须登记 simplified；
//      注册表的 campaign simplified 集合必须恰好等于 22 ∪ 8 锚点。
// ---------------------------------------------------------------------------
const playerLedger = JSON.parse(fs.readFileSync(
  path.join(root, game, 'audit/tde-player-acceptance.json'), 'utf8'))
const playerSimplifiedNotes = new Map(playerLedger.entries
  .filter(entry => entry.simplified).map(entry => [entry.code, entry.note]))
if (playerSimplifiedNotes.size !== playerLedger.summary.simplified) {
  throw new Error(`Unexpected P7 player simplified count: ${playerSimplifiedNotes.size}`)
}
for (const code of playerCodes) {
  const registered = TDE_CARD_ACCEPTANCE_NOTES[code]
  const playerNote = playerSimplifiedNotes.get(code)
  if (Boolean(playerNote) !== Boolean(registered && registered.status === 'simplified')) {
    throw new Error(`玩家卡 simplified 登记与 P7 账本不一致：${code}`)
  }
  if (playerNote && registered.note !== playerNote) {
    throw new Error(`玩家卡 simplified note 与 P7 账本不一致：${code}`)
  }
  if (playerNote && !(registered.sources || []).includes('P7')) {
    throw new Error(`玩家卡 simplified 备注缺少 P7 来源：${code}`)
  }
}
const entryByCode = new Map(NON_PLAYER_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
const p8CardSimplifiedCodes = [...entryByCode.values()]
  .filter(entry => campaignCodes.has(entry.code) || campaignFaceCodes.has(entry.code))
  .filter(entry => entry.simplified === true)
  .map(entry => entry.code)
  .sort()
if (p8CardSimplifiedCodes.length !== 0) {
  throw new Error(`Unexpected P8 single-card simplified count: ${p8CardSimplifiedCodes.length}`)
}
for (const code of p8CardSimplifiedCodes) {
  const registered = TDE_CARD_ACCEPTANCE_NOTES[code]
  if (!registered || registered.status !== 'simplified') {
    throw new Error(`P8 单卡条目声明 simplified 但备注注册表未登记：${code}`)
  }
  const entry = entryByCode.get(code)
  if (entry?.note && registered.note !== entry.note) {
    throw new Error(`P8 单卡条目 note 与备注注册表不一致：${code}`)
  }
  if (!(registered.sources || []).includes('P8-card')) {
    throw new Error(`P8 单卡 simplified 备注缺少 P8-card 来源：${code}`)
  }
}
const triagePath = path.join(root, game, TDE_SCENARIO_GAP_TRIAGE_FILE)
const triage = JSON.parse(fs.readFileSync(triagePath, 'utf8'))
if (!Array.isArray(triage.gaps) || triage.gaps.length !== 0) {
  throw new Error(`Unexpected P8 scenarioGaps triage count: ${triage.gaps?.length}`)
}
const triageGapIds = new Set()
const triageCodesByChapter = new Map(chapters.map(chapter => [chapter.id, []]))
const triageCodes = new Set()
let totalGaps = 0
for (const chapter of chapters) {
  const sourceGaps = chapterModules[chapter.id].behavior?.scenarioGaps || []
  totalGaps += sourceGaps.length
  for (const gap of triage.gaps.filter(candidate => candidate.chapterId === chapter.id)) {
    if (gap.index < 0 || gap.index >= sourceGaps.length) {
      throw new Error(`triage gap index 越界：${gap.chapterId}#${gap.index}`)
    }
    if (gap.gap !== sourceGaps[gap.index]) {
      throw new Error(`triage gap 原文与 behavior.scenarioGaps[${gap.index}] 不一致：${gap.id}`)
    }
    if (triageGapIds.has(gap.id)) throw new Error(`triage gap id 重复：${gap.id}`)
    triageGapIds.add(gap.id)
    for (const code of gap.codes || []) {
      const registered = TDE_CARD_ACCEPTANCE_NOTES[code]
      if (!registered || registered.status !== 'simplified') {
        throw new Error(`triage gap 锚点未登记 simplified：${gap.id} → ${code}`)
      }
      if (!(registered.gaps || []).includes(gap.id)) {
        throw new Error(`注册表备注缺少 gapRef：${code} → ${gap.id}`)
      }
      if (!(chaptersByCode.get(code) || []).includes(chapter.id)) {
        throw new Error(`triage gap 锚点不属于该章：${gap.id} → ${code}`)
      }
      triageCodes.add(code)
      triageCodesByChapter.get(chapter.id).push(code)
    }
  }
}
if (totalGaps !== 0) throw new Error(`Unexpected P8 scenarioGaps count: ${totalGaps}`)
if (triageGapIds.size !== 0) throw new Error(`triage 未覆盖全部 12 条 gap：${triageGapIds.size}`)
const derivedGapCards = Object.fromEntries(chapters.map(chapter => [chapter.id,
  [...new Set(triageCodesByChapter.get(chapter.id))].sort()]))
for (const chapter of chapters) {
  const expected = JSON.stringify(derivedGapCards[chapter.id])
  const declared = JSON.stringify(TDE_SCENARIO_GAP_CARDS[chapter.id] || [])
  if (expected !== declared) {
    throw new Error(`TDE_SCENARIO_GAP_CARDS 与 triage 不一致：${chapter.id} ${declared} ≠ ${expected}`)
  }
}
const registeredCampaignSimplified = Object.keys(TDE_CARD_ACCEPTANCE_NOTES)
  .filter(code => (campaignCodes.has(code) || campaignFaceCodes.has(code))
    && TDE_CARD_ACCEPTANCE_NOTES[code].status === 'simplified')
  .sort()
const expectedCampaignSimplified = [...new Set([...p8CardSimplifiedCodes, ...triageCodes])].sort()
if (JSON.stringify(registeredCampaignSimplified) !== JSON.stringify(expectedCampaignSimplified)) {
  throw new Error('战役 simplified 集合与「22 条 P8 单卡 + 8 个 gap 锚点」不一致')
}
if (TDE_P6_SIMPLIFICATION_CODES.length !== 0) {
  throw new Error('P6 调查员简化应为 0（历史简化已在 P6/P8 还账）')
}

// noEntry（10 条）必须与「战役记录 − 单卡条目」完全一致。
const noEntryCodes = new Set(TDE_NO_ENTRY_CODES)
const expectedNoEntry = [...campaignCodes, ...campaignFaceCodes]
  .filter(code => !entryByCode.has(code))
  .sort()
if (expectedNoEntry.length !== noEntryCodes.size) {
  throw new Error(`noEntry 数量与「无单卡条目」的战役记录不一致：${expectedNoEntry.length} / ${noEntryCodes.size}`)
}
for (const code of expectedNoEntry) {
  if (!noEntryCodes.has(code)) throw new Error(`无单卡条目的战役记录未登记 noEntry：${code}`)
}
for (const code of noEntryCodes) {
  if (entryByCode.has(code)) throw new Error(`noEntry 卡不应有单卡条目：${code}`)
  if (!ALL_CARDS[code]) throw new Error(`noEntry 卡不存在：${code}`)
  if (!TDE_NO_ENTRY_REASONS[code]) throw new Error(`noEntry 缺少理由：${code}`)
}
const scenarioReferenceCodes = new Set(chapters.map(chapter => chapter.code))
for (const code of scenarioReferenceCodes) {
  if (!noEntryCodes.has(code)) throw new Error(`剧本参考卡必须记 noEntry：${code}`)
}
const noEntryStoryFaces = [...noEntryCodes]
  .filter(code => /[a-z]$/.test(code))
  .filter(code => ALL_CARDS[code].type === 'story')
if (noEntryStoryFaces.length !== 2 || !noEntryStoryFaces.includes('06057b') || !noEntryStoryFaces.includes('06058b')) {
  throw new Error(`noEntry 故事面应为 06057b/06058b：${noEntryStoryFaces.join(',')}`)
}
const unknownNotes = Object.keys(TDE_CARD_ACCEPTANCE_NOTES)
  .filter(code => !tde.some(card => card.code === code))
if (unknownNotes.length) throw new Error(`逐卡备注登记了不存在/越界的卡：${unknownNotes.join(', ')}`)
if (Object.keys(TDE_CARD_ACCEPTANCE_NOTES).length !== playerSimplifiedNotes.size + expectedCampaignSimplified.length) {
  throw new Error(`Unexpected TDE note registry size: ${Object.keys(TDE_CARD_ACCEPTANCE_NOTES).length}`)
}

// ---------------------------------------------------------------------------
// entry 组装
// ---------------------------------------------------------------------------
function evidenceOf(result) {
  return { file: relativeFile(result), line: result.line ?? null, test: result.name }
}
function facePartnerOf(code) {
  const card = ALL_CARDS[code]
  const direct = card.linkedCardCode || card.linkedToCode || null
  const reverse = Object.values(ALL_CARDS)
    .filter(other => other.code !== code
      && (other.linkedCardCode === code || other.linkedToCode === code))
    .map(other => other.code)
  const related = [...new Set([direct, ...reverse].filter(Boolean))]
  if (related.length !== 1) throw new Error(`关联面必须恰好链接一个记录：${code} → ${related.join(',')}`)
  return related[0]
}
function channelOf(code) {
  if (scenarioReferenceCodes.has(code)) return 'scenario-definition'
  if (code === '06057b' || code === '06058b') return 'linked-face'
  if (code === '06015a' || code === '06015b') return 'engine'
  if (playerCodes.has(code) || investigatorCodes.has(code)) return 'descriptor'
  return 'encounter-entry'
}

const entries = []
for (const card of [...mainCards, ...faceCards].sort((left, right) => left.code.localeCompare(right.code))) {
  const code = card.code
  const pack = packOf(code)
  const kind = kindOf(code)
  const { note, noteStatus, noteSources, gapRefs } = noteFor(code)
  let status
  let evidence
  if (pack === 'tdeInvestigators') {
    status = investigatorCodes.has(code) && !tdeInvestigatorCardVerified(code) ? 'pending' : 'verified'
    if (noteStatus === 'simplified') status = 'pending'
    evidence = [{
      file: files[0],
      profile: TDE_INVESTIGATOR_ACCEPTANCE_PROFILE.id,
      tests: investigatorResults.length,
      scope: 'M1 逐人验收（文件级证据：whole-file 实跑通过）',
    }]
  } else if (pack === 'tdePlayer') {
    status = tdePlayerCardVerified(code) ? 'verified' : 'pending'
    evidence = (playerByCode.get(code) || []).map(evidenceOf)
  } else {
    const assessment = campaignByCode.get(code)
    status = assessment.status
    evidence = [evidenceOf(assessment.result)]
  }
  const isNoEntry = noEntryCodes.has(code)
  entries.push({
    code,
    name: card.nameZh || card.name,
    type: card.type,
    printPack: card.pack,
    pack,
    kind,
    ...(kind === 'face' ? { faceOf: facePartnerOf(code) } : {}),
    ...(scenarioReferenceCodes.has(code)
      ? { chapterId: chapters.find(chapter => chapter.code === code)?.id || null }
      : {}),
    noEntry: isNoEntry,
    channel: channelOf(code),
    status,
    note: note ?? (isNoEntry ? TDE_NO_ENTRY_REASONS[code] : null),
    noteStatus,
    noteSources,
    gapRefs,
    chapters: pack === 'tdeCampaign' ? (chaptersByCode.get(code) || []) : [],
    evidence,
  })
}
if (entries.length !== 388) throw new Error(`Unexpected TDE all-card ledger scope: ${entries.length}`)
if (new Set(entries.map(entry => entry.code)).size !== entries.length) {
  throw new Error('账本存在重复卡号')
}
if (entries.filter(entry => entry.noEntry).length !== 10) throw new Error('noEntry 记录数不是 10')
for (const entry of entries.filter(candidate => !candidate.noEntry)) {
  if (!implementedFor(entry.code) && entry.channel !== 'engine' && entry.channel !== 'descriptor') {
    throw new Error(`非 noEntry 战役卡缺少 implementedFor 行为入口：${entry.code}`)
  }
}
const channelCounts = entries.reduce((result, entry) => {
  result[entry.channel] = (result[entry.channel] || 0) + 1
  return result
}, {})
const expectedChannelCounts = {
  descriptor: 103, 'encounter-entry': 273, 'scenario-definition': 8, 'linked-face': 2, engine: 2,
}
for (const [channel, expected] of Object.entries(expectedChannelCounts)) {
  if (channelCounts[channel] !== expected) {
    throw new Error(`Unexpected channel count for ${channel}: ${channelCounts[channel]}`)
  }
}

// ---------------------------------------------------------------------------
// 账本、summary、生成模块
// ---------------------------------------------------------------------------
// 玩家卡两套口径（分开记账，两个数字都可由卡面数据独立复算）：
//   buildable  = 72 张可入牌组（非基础弱点且 deckLimit>0）；
//   dependencyOnly = 15 张只作依赖（11 张 deckLimit=0 的场外绑定卡/绑定弱点 + 4 张基础弱点）。
const buildableCodes = [...TDE_PLAYER_BUILDABLE_CODES]
const dependencyCodes = [...TDE_PLAYER_DEPENDENCY_CODES]
const basicWeaknessCodes = [...TDE_PLAYER_BASIC_WEAKNESS_CODES]
const buildable = buildableCodes.length
const deckable = buildableCodes.filter(code => (ALL_CARDS[code]?.deckLimit ?? 2) > 0).length
const dependencyOnly = dependencyCodes.length
if (buildable !== 72) throw new Error(`Unexpected TDE buildable count: ${buildable}`)
if (dependencyOnly !== 15) throw new Error(`Unexpected TDE dependency count: ${dependencyOnly}`)
if (basicWeaknessCodes.length !== 4) throw new Error(`Unexpected TDE basic-weakness count: ${basicWeaknessCodes.length}`)
if (buildable + dependencyOnly !== playerCodes.size) throw new Error('玩家 87 与 buildable/dependency 对账失败')
if (dependencyCodes.some(code => buildableCodes.includes(code))) {
  throw new Error('dependencyOnly 与可入牌组集合重叠')
}

const countBy = predicate => entries.filter(predicate).length
const simplifiedPlayer = Object.keys(TDE_CARD_ACCEPTANCE_NOTES)
  .filter(code => playerCodes.has(code) && TDE_CARD_ACCEPTANCE_NOTES[code].status === 'simplified').length
const simplifiedCampaign = Object.keys(TDE_CARD_ACCEPTANCE_NOTES)
  .filter(code => (campaignCodes.has(code) || campaignFaceCodes.has(code))
    && TDE_CARD_ACCEPTANCE_NOTES[code].status === 'simplified').length
const simplifiedInvestigator = Object.keys(TDE_CARD_ACCEPTANCE_NOTES)
  .filter(code => (investigatorCodes.has(code) || investigatorFaceCodes.has(code))
    && TDE_CARD_ACCEPTANCE_NOTES[code].status === 'simplified').length

const profile = {
  id: 'dream-eaters-all-cards-2026-11',
  scope: '食梦者原始循环 388 条印刷记录：352 张主卡（战役 249 / 调查员 16 / 玩家 87）与 36 个关联面（34 战役面 + 2 调查员面 06015a/b）。',
  basis: `逐卡运行测试：283 条战役记录（249 主卡 + 34 关联面）的卡面印刷数据与 8 章 definition/index 逐字段对照（tests/tde-campaign-card-acceptance.test.mjs ${campaignByCode.size} 例逐卡证据）、87 张玩家卡 4 个分片（tests/tde-player-m2-{1..4}.test.mjs ${playerLedger.summary.testsPassed} 例）、18 条调查员记录 M1 逐人验收（tests/tde-investigators.test.mjs ${investigatorResults.length} 例，文件级）；证据只从实跑 node --test 的 test:pass 事件归集。`,
  partitionPolicy: '包分区 campaign 283（249 主 + 34 面）/ investigator 18（16 主 + 2 面）/ player 87，合计 388；形态分区 main 352 + face 36，合计 388；两套各自守恒。34 战役面按 linkedCardCode/linkedToCode 反查归正面（06169a/b 成对互链）；06015a/b 归调查员包（UNOWNED_FACE_OVERRIDES）。',
  pendingPolicy: '目录存在、卡号被源码引用、rulesPending:false 或文本非空都不构成通过；未被逐卡 test 标记「已验收」/未被 manifest verified 的卡保持 pending 并计入 summary.pending（当前 0）。',
  notePolicy: '本轮完成旧简化的规则补全；当前显式简化必须为零。旧备注与逐项实现证据保存在 audit/tde-completion-review.json。',
  gapPolicy: '当前未解决章节缺口必须为零；历史十二条缺口及修复证据保存在 audit/tde-scenario-gap-triage.json 的 resolvedGaps。',
  playerCardPolicy: `玩家 87 全部 verified；buildable=${buildable}（可入牌组）、dependencyOnly=${dependencyOnly}（11 张 deckLimit=0 的场外绑定卡/绑定弱点 + ${basicWeaknessCodes.length} 张基础弱点），deckable=${deckable}（可入牌组里 deckLimit>0）。`,
  inheritedProfiles: [TDE_INVESTIGATOR_ACCEPTANCE_PROFILE.id, TDE_PLAYER_ACCEPTANCE_PROFILE.id],
  sources: [
    'src/cards/cards-data.js',
    'content/campaigns/theDreamEaters/card-data.js',
    'content/campaigns/theDreamEaters/card-acceptance.js',
    'content/campaigns/theDreamEaters/scenarios/<8 章>/{index,definition,behavior}.js',
    'src/cards/encounter-entries/theDreamEaters/**/<code>.js',
    'src/cards/card-rules.js（implementedFor）',
    'audit/tde-scenario-gap-triage.json',
    '参考资源/ArkhamHorror-main/frontend/public/cards_zh-cn.json',
  ],
}
const summary = {
  total: entries.length,
  verified: countBy(entry => entry.status === 'verified'),
  pending: countBy(entry => entry.status === 'pending'),
  // 包分区（= scope packs，和 = total）
  campaign: countBy(entry => entry.pack === 'tdeCampaign'),
  investigator: countBy(entry => entry.pack === 'tdeInvestigators'),
  player: countBy(entry => entry.pack === 'tdePlayer'),
  // 形态分区（和 = total）
  main: countBy(entry => entry.kind === 'main'),
  face: countBy(entry => entry.kind === 'face'),
  // 兼容别名（早期任务书口径）
  mainCards: countBy(entry => entry.kind === 'main'),
  faces: countBy(entry => entry.kind === 'face'),
  campaignMain: countBy(entry => entry.pack === 'tdeCampaign' && entry.kind === 'main'),
  campaignFaces: countBy(entry => entry.pack === 'tdeCampaign' && entry.kind === 'face'),
  campaignFace: countBy(entry => entry.pack === 'tdeCampaign' && entry.kind === 'face'),
  investigatorMain: countBy(entry => entry.pack === 'tdeInvestigators' && entry.kind === 'main'),
  investigatorFaces: countBy(entry => entry.pack === 'tdeInvestigators' && entry.kind === 'face'),
  investigatorFace: countBy(entry => entry.pack === 'tdeInvestigators' && entry.kind === 'face'),
  playerMain: countBy(entry => entry.pack === 'tdePlayer' && entry.kind === 'main'),
  // 玩家口径（P7）
  buildable,
  deckable,
  dependencyOnly,
  dependency: dependencyOnly,
  basicWeaknesses: basicWeaknessCodes.length,
  // 简化与 noEntry
  simplified: countBy(entry => entry.noteStatus === 'simplified'),
  simplifiedPlayer,
  simplifiedCampaign,
  simplifiedInvestigator,
  noEntry: countBy(entry => entry.noEntry),
  scenarioReferenceCards: scenarioReferenceCodes.size,
  recordsWithEntry: countBy(entry => entry.pack === 'tdeCampaign' && !entry.noEntry),
  scenarioGaps: totalGaps,
  implementationChannels: channelCounts,
  testsPassed: results.length,
  testFiles: files.length,
}
const expectedCounts = {
  total: 388, campaign: 283, investigator: 18, player: 87,
  main: 352, face: 36, campaignMain: 249, campaignFaces: 34,
  investigatorMain: 16, investigatorFaces: 2, playerMain: 87,
  buildable: 72, dependencyOnly: 15, basicWeaknesses: 4,
  simplified: 0, simplifiedPlayer: 0, simplifiedCampaign: 0, simplifiedInvestigator: 0,
  noEntry: 10, scenarioReferenceCards: 8, recordsWithEntry: 273, scenarioGaps: 0,
}
for (const [key, expected] of Object.entries(expectedCounts)) {
  if (summary[key] !== expected) throw new Error(`Unexpected ledger ${key}: ${summary[key]}`)
}
if (summary.verified + summary.pending !== summary.total) throw new Error('verified/pending 与 total 对账失败')
if (summary.campaign + summary.investigator + summary.player !== summary.total) throw new Error('包分区不守恒')
if (summary.main + summary.face !== summary.total) throw new Error('形态分区不守恒')
if (summary.campaignMain + summary.campaignFaces !== summary.campaign) throw new Error('campaign 包/形态不守恒')
if (summary.investigatorMain + summary.investigatorFaces !== summary.investigator) {
  throw new Error('investigator 包/形态不守恒')
}
if (summary.playerMain !== summary.player) throw new Error('player 包/形态不守恒')
if (summary.campaign !== campaignCodes.size + campaignFaceCodes.size) throw new Error('campaign 分区对账失败')
if (summary.investigator !== investigatorCodes.size + investigatorFaceCodes.size) throw new Error('investigator 分区对账失败')
if (summary.player !== playerCodes.size) throw new Error('player 分区对账失败')
if (summary.simplified !== simplifiedPlayer + simplifiedCampaign + simplifiedInvestigator) {
  throw new Error('simplified 分区对账失败')
}

const ledger = {
  schemaVersion: 1,
  generatedBy: 'tools/audit-tde-all-cards.mjs',
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
  .filter(entry => entry.pack === 'tdeCampaign' && entry.status === 'verified')
  .map(entry => entry.code)
const campaignPending = entries
  .filter(entry => entry.pack === 'tdeCampaign' && entry.status === 'pending')
  .map(entry => entry.code)
const campaignMainVerified = entries
  .filter(entry => entry.pack === 'tdeCampaign' && entry.kind === 'main' && entry.status === 'verified')
  .map(entry => entry.code)
const campaignFaceVerified = entries
  .filter(entry => entry.pack === 'tdeCampaign' && entry.kind === 'face' && entry.status === 'verified')
  .map(entry => entry.code)
const campaignSimplified = entries
  .filter(entry => entry.pack === 'tdeCampaign' && entry.noteStatus === 'simplified')
  .map(entry => entry.code)
const investigatorVerified = entries
  .filter(entry => entry.pack === 'tdeInvestigators' && entry.status === 'verified')
  .map(entry => entry.code)
const allVerified = entries.filter(entry => entry.status === 'verified').map(entry => entry.code)
const allSimplified = entries.filter(entry => entry.noteStatus === 'simplified').map(entry => entry.code)
const module = `// Generated by tools/audit-tde-all-cards.mjs after executing TDE all-card acceptance tests.
// Detailed evidence: audit/tde-all-card-acceptance.json.
//
// 注意：本模块的 tdeCampaignCardVerified 覆盖 283 条战役记录（249 主卡 + 34 关联面）；
// content/packs/tdeCampaign/manifest.js 的同名读点只判 249 张主卡（含 8 张剧本参考卡）。
export const TDE_ALL_CARD_ACCEPTANCE_PROFILE = ${JSON.stringify(profile, null, 2)}
export const TDE_ALL_CARD_ACCEPTANCE_SHA256 = '${hash(json)}'
export const TDE_CAMPAIGN_VERIFIED_CODES = Object.freeze(${JSON.stringify(campaignVerified)})
export const TDE_CAMPAIGN_PENDING_CODES = Object.freeze(${JSON.stringify(campaignPending)})
export const TDE_CAMPAIGN_MAIN_VERIFIED_CODES = Object.freeze(${JSON.stringify(campaignMainVerified)})
export const TDE_CAMPAIGN_FACE_VERIFIED_CODES = Object.freeze(${JSON.stringify(campaignFaceVerified)})
export const TDE_CAMPAIGN_SIMPLIFIED_CODES = Object.freeze(${JSON.stringify(campaignSimplified)})
export const TDE_INVESTIGATOR_RECORD_VERIFIED_CODES = Object.freeze(${JSON.stringify(investigatorVerified)})
export const TDE_ALL_CARD_VERIFIED_CODES = Object.freeze(${JSON.stringify(allVerified)})
export const TDE_ALL_CARD_SIMPLIFIED_CODES = Object.freeze(${JSON.stringify(allSimplified)})
export const tdeAllCardAcceptance = Object.freeze(${JSON.stringify(summary)})
const campaignVerifiedSet = new Set(TDE_CAMPAIGN_VERIFIED_CODES)
const campaignPendingSet = new Set(TDE_CAMPAIGN_PENDING_CODES)
const campaignMainVerifiedSet = new Set(TDE_CAMPAIGN_MAIN_VERIFIED_CODES)
const campaignFaceVerifiedSet = new Set(TDE_CAMPAIGN_FACE_VERIFIED_CODES)
const campaignSimplifiedSet = new Set(TDE_CAMPAIGN_SIMPLIFIED_CODES)
const investigatorVerifiedSet = new Set(TDE_INVESTIGATOR_RECORD_VERIFIED_CODES)
const allVerifiedSet = new Set(TDE_ALL_CARD_VERIFIED_CODES)
const allSimplifiedSet = new Set(TDE_ALL_CARD_SIMPLIFIED_CODES)
export const tdeCampaignCardVerified = code => campaignVerifiedSet.has(code)
export const tdeCampaignCardAcceptanceVerified = code => campaignVerifiedSet.has(code)
export const tdeCampaignCardPending = code => campaignPendingSet.has(code)
export const tdeCampaignMainVerified = code => campaignMainVerifiedSet.has(code)
export const tdeCampaignFaceVerified = code => campaignFaceVerifiedSet.has(code)
export const tdeCampaignCardAcceptanceSimplified = code => campaignSimplifiedSet.has(code)
export const tdeInvestigatorRecordVerified = code => investigatorVerifiedSet.has(code)
export const tdeAllCardVerified = code => allVerifiedSet.has(code)
export const tdeAllCardSimplified = code => allSimplifiedSet.has(code)
`
for (const [file, text] of [
  ['audit/tde-all-card-acceptance.json', json],
  ['src/cards/tde-campaign-acceptance.js', module],
]) {
  const destination = path.join(root, game, file)
  if (process.argv.includes('--write')) fs.writeFileSync(destination, text)
  else if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) {
    throw new Error(`Acceptance artifact stale: ${file}`)
  }
}
console.log(JSON.stringify(summary))
