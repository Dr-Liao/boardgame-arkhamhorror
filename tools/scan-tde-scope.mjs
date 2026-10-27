#!/usr/bin/env node
// 食梦者（The Dream Eaters）M0 范围与来源账本：P1 的唯一事实源。
//
//   node tools/scan-tde-scope.mjs --write   生成 artifacts/migration/tde/scope.json
//   node tools/scan-tde-scope.mjs --check   复算并与磁盘逐字节比对（来源 / 归属变化即失败）
//   node tools/scan-tde-scope.mjs           打印 JSON（report 模式，不写盘）
//
// 口径（docs/tde-migration-roadmap.md §1、§3）：
//   · 388 条印刷记录 = 352 主卡 + 36 关联面；三包 283 / 18 / 87，无重叠、无遗漏；
//   · 20 个遭遇组 = 8 章节组 + 12 共享组，组卡合计 283（249 主卡 + 34 面）；
//   · 8 章 × 1 组一一对应；4 个章对各含 A/B 两线各一章；
//   · 来源逐文件锁 SHA-256（参考实现 15 + 剧情 19 + 卡表 4 + 仓内事实源 5）；
//   · 基线 = 规则版本 + golden replay 计数 + replay-before.json 逐条一致；
//   · 分片索引两两无交集、并集 = 388；章节按归属目录切，Search 53 张拆主卡 / 面两片。
//
// 状态不手写：三包清单读 content/packs/tde*/manifest.js 的导出码表，章节与遭遇组读
// content/campaigns/theDreamEaters/shared.js；本工具只复算、对账并把不一致写成 gate 失败。
// `gitHead` 不入账本（提交会变，账本要能长期复算）：基线提交存
// artifacts/migration/tde/reports/baseline-git-head.txt。

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import { CAMPAIGN_CARD_CODES, CAMPAIGN_FACE_CODES } from '../content/packs/tdeCampaign/manifest.js'
import { INVESTIGATOR_CARD_CODES, UNOWNED_FACE_OVERRIDES } from '../content/packs/tdeInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tdePlayer/manifest.js'
import {
  ENCOUNTER_GROUP_CODES, ENCOUNTER_GROUP_IDS, PAIR_COUNT, PARTS, chapters,
  SHARED_ENCOUNTER_GROUPS, MODES,
} from '../content/campaigns/theDreamEaters/shared.js'

const MOD_ROOT = fileURLToPath(new URL('../', import.meta.url))
// 参考资源在仓库根目录（与本 Mod 目录同级的上两级），与 audit-carcosa.mjs 同名约定一致。
const WORKSPACE_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SCOPE_FILE = 'artifacts/migration/tde/scope.json'
const REPLAY_BEFORE_FILE = 'artifacts/migration/tde/replay-before.json'
const GOLDEN_FILE = 'tests/fixtures/replay/golden-replays.json'
const REFERENCE_ROOT = '参考资源/ArkhamHorror-main'
const MODE = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check'
    : process.argv.includes('--images') ? 'images'
      : 'report'

// M0 硬口径：数字来自路线图 §1（卡面复算已在 P0 用 data 核对过），任何一项偏离都会让 gate 失败。
const EXPECTED = Object.freeze({
  main: 352,
  faces: 36,
  records: 388,
  packMain: { tdeCampaign: 249, tdeInvestigators: 16, tdePlayer: 87 },
  packFaces: { tdeCampaign: 34, tdeInvestigators: 2, tdePlayer: 0 },
  packRecords: { tdeCampaign: 283, tdeInvestigators: 18, tdePlayer: 87 },
  chapterGroups: 8,
  sharedGroups: 12,
  encounterGroups: 20,
  chapterRecords: 253,
  sharedRecords: 30,
  campaignRecords: 283,
  investigators: 5,
  signatures: 11,
  printPacks: { tde: 112, sfk: 62, tsh: 41, dsm: 40, pnr: 54, wgd: 47, woc: 32 },
  sources: 43,
})

// 跨循环通用遭遇组：参考实现 gather 引用 ↔ 仓库 encounter-entries/shared/ 目录。
// DarkCult 的映射由卡池 encounterName='Dark Cult' 证实（不是猜测），目录名沿用 ArkhamDB 的 pentagram。
const CROSS_CYCLE_GROUPS = Object.freeze([
  { id: 'lockedDoors', encounterCode: 'locked_doors', set: 'LockedDoors', repoDir: 'shared/locked_doors' },
  { id: 'strikingFear', encounterCode: 'striking_fear', set: 'StrikingFear', repoDir: 'shared/striking_fear' },
  { id: 'chillingCold', encounterCode: 'chilling_cold', set: 'ChillingCold', repoDir: 'shared/chilling_cold' },
  { id: 'ghouls', encounterCode: 'ghouls', set: 'Ghouls', repoDir: 'shared/ghouls' },
  { id: 'rats', encounterCode: 'rats', set: 'Rats', repoDir: 'shared/rats' },
  { id: 'ancientEvils', encounterCode: 'ancient_evils', set: 'AncientEvils', repoDir: 'shared/ancient_evils' },
  { id: 'nightgaunts', encounterCode: 'nightgaunts', set: 'Nightgaunts', repoDir: 'shared/nightgaunts' },
  {
    id: 'darkCult', encounterCode: 'dark_cult', set: 'DarkCult', repoDir: 'shared/pentagram',
    note: 'ArkhamDB 的 pentagram 组 = 卡池 encounterName「Dark Cult」；与参考实现 Set.DarkCult 对应',
  },
])

const SCENARIO_HS_FILES = Object.freeze({
  beyondTheGatesOfSleep: 'BeyondTheGatesOfSleep.hs',
  wakingNightmare: 'WakingNightmare.hs',
  theSearchForKadath: 'TheSearchForKadath.hs',
  aThousandShapesOfHorror: 'AThousandShapesOfHorror.hs',
  darkSideOfTheMoon: 'DarkSideOfTheMoon.hs',
  pointOfNoReturn: 'PointOfNoReturn.hs',
  whereTheGodsDwell: 'WhereTheGodsDwell.hs',
  weaverOfTheCosmos: 'WeaverOfTheCosmos.hs',
})

const isMain = code => /^06\d{3}$/.test(code)
const isFace = code => /^06\d{3}[a-z]$/.test(code)
const mainCodes = Object.keys(ALL_CARDS).filter(isMain).sort()
const faceCodes = Object.keys(ALL_CARDS).filter(isFace).sort()
const stableSort = values => [...values].sort()

const sha256 = (relativePath, base = MOD_ROOT) => {
  const absolute = `${base}${relativePath}`
  if (!existsSync(absolute)) return { exists: false, bytes: 0, sha256: null }
  const buffer = readFileSync(absolute)
  return { exists: true, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') }
}

// ── 三包归属 ────────────────────────────────────────────────────────────────
const packCodes = {
  tdeCampaign: stableSort(CAMPAIGN_CARD_CODES),
  tdeInvestigators: stableSort(INVESTIGATOR_CARD_CODES),
  tdePlayer: stableSort(PLAYER_CARD_CODES),
}
const owner = new Map()
for (const [pack, codes] of Object.entries(packCodes)) {
  for (const code of codes) {
    if (owner.has(code)) throw new Error(`卡号重复归属：${code}（${owner.get(code)} / ${pack}）`)
    owner.set(code, pack)
  }
}
const unassignedMains = mainCodes.filter(code => !owner.has(code))
const unknownOwned = [...owner.keys()].filter(code => !mainCodes.includes(code))

// ── 关联面归属：encounterCode 优先，无主双面卡按显式 override 登记 ─────────────
const faces = faceCodes.map(code => {
  const card = ALL_CARDS[code]
  const encounterCode = card.encounterCode || null
  const override = UNOWNED_FACE_OVERRIDES[code] || null
  const byCode = encounterCode ? 'tdeCampaign' : null
  const pack = override?.pack || byCode || null
  return {
    code,
    pack,
    source: override ? 'override' : byCode ? 'encounterCode' : 'none',
    encounterCode,
    overrideReason: override?.reason || null,
    // override 与 encounterCode 规则是否互相印证（06169a/b 为 true，06015a/b 为 null）。
    agreesWithEncounterCode: override && encounterCode ? pack === byCode : null,
  }
})
const unassignedFaces = faces.filter(face => !face.pack)
const facePackOf = code => faces.find(face => face.code === code)?.pack || null

const packStats = Object.fromEntries(Object.keys(packCodes).map(pack => {
  const main = packCodes[pack].length
  const face = faces.filter(entry => entry.pack === pack).length
  const codes = [...packCodes[pack], ...faces.filter(entry => entry.pack === pack).map(entry => entry.code)].sort()
  return [pack, { main, faces: face, records: main + face, from: codes[0], to: codes[codes.length - 1] }]
}))

// ── 20 个遭遇组：卡池 encounterCode ⇒ 内容侧 id，逐组对账 ─────────────────────
const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]))
const groupRecords = new Map(ENCOUNTER_GROUP_IDS.map(id => [id, []]))
const unmappedDataGroups = new Set()
for (const code of [...mainCodes, ...faceCodes]) {
  const encounterCode = ALL_CARDS[code].encounterCode
  if (!encounterCode) continue
  const id = Object.keys(ENCOUNTER_GROUP_CODES).find(key => ENCOUNTER_GROUP_CODES[key] === encounterCode)
  if (!id) { unmappedDataGroups.add(encounterCode); continue }
  groupRecords.get(id).push(code)
}

const encounterGroups = ENCOUNTER_GROUP_IDS.map(id => {
  const records = groupRecords.get(id).sort()
  const chapter = chapterById.get(id) || null
  return {
    id,
    encounterCode: ENCOUNTER_GROUP_CODES[id],
    kind: chapter ? 'chapter' : 'shared',
    chapterId: chapter ? chapter.id : null,
    part: chapter ? chapter.part : null,
    pair: chapter ? chapter.pair : null,
    main: records.filter(isMain).length,
    faces: records.filter(isFace).length,
    records: records.length,
  }
})
const dataGroups = new Set(Object.values(ENCOUNTER_GROUP_CODES))
// 声明了但卡池里一张都没有的组（反向缺口）；卡池里出现、shared.js 没声明的组走 unmappedDataGroups。
const missingFromShared = ENCOUNTER_GROUP_IDS.filter(id => (groupRecords.get(id) || []).length === 0)

// ── 8 章对账：每组卡数、参考卡、卡包、章对 ─────────────────────────────────
const chapterLedger = chapters.map(chapter => {
  const records = (groupRecords.get(chapter.id) || []).slice().sort()
  const card = ALL_CARDS[chapter.code]
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    nameEn: chapter.nameEn,
    part: chapter.part,
    pair: chapter.pair,
    packCode: chapter.packCode,
    encounterCode: chapter.encounterCode,
    encounterGroup: chapter.id,
    referenceCardType: card?.type || null,
    referenceCardPack: card?.pack || null,
    nameMatchesCard: card ? (card.nameZh === chapter.name && card.name === chapter.nameEn) : false,
    main: records.filter(isMain).length,
    faces: records.filter(isFace).length,
    records: records.length,
  }
})

// ── 跨循环通用遭遇组：仓库目录 + 参考实现 gather 引用 ────────────────────────
const scenarioSource = chapterId => {
  const file = SCENARIO_HS_FILES[chapterId]
  if (!file) return ''
  const path = `${REFERENCE_ROOT}/backend/arkham-api/library/Arkham/Scenario/Scenarios/TheDreamEaters/${file}`
  return existsSync(`${WORKSPACE_ROOT}${path}`) ? readFileSync(`${WORKSPACE_ROOT}${path}`, 'utf8') : ''
}
const gatherRefs = Object.fromEntries(chapters.map(chapter => {
  const source = scenarioSource(chapter.id)
  const sets = [...source.matchAll(/gather(?:AndSetAside)? Set\.(\w+)/g)].map(match => match[1])
  return [chapter.id, [...new Set(sets)]]
}))
const crossCycleGroups = CROSS_CYCLE_GROUPS.map(group => {
  const repoDir = `src/cards/encounter-entries/${group.repoDir}`
  const gatheredBy = chapters.map(chapter => chapter.id)
    .filter(chapterId => gatherRefs[chapterId].includes(group.set))
  const sampleCard = Object.values(ALL_CARDS).find(card => card.encounterName
    === group.set.replace(/([a-z])([A-Z])/g, '$1 $2'))
  return {
    id: group.id,
    encounterCode: group.encounterCode,
    referenceSet: `Set.${group.set}`,
    repoDir,
    repoDirExists: existsSync(`${MOD_ROOT}${repoDir}`),
    cardEncounterName: sampleCard?.encounterName || null,
    gatheredBy,
    note: group.note || null,
  }
})

// ── 分片草案：M1 / M2 / M3（P6/P7/P8 的实际分片以此为准）──────────────────
const chunk = (values, sizes) => {
  const out = []
  let offset = 0
  for (const size of sizes) { out.push(values.slice(offset, offset + size)); offset += size }
  if (offset < values.length) out.push(values.slice(offset))
  return out
}
const recordsOfGroup = groupId => (groupRecords.get(groupId) || []).slice().sort()
const playerWaves = chunk(packCodes.tdePlayer, [22, 22, 22, 21]).map((codes, index) => ({ id: `M2-${index + 1}`, codes }))
const chapterShards = chapters.map(chapter => {
  const records = recordsOfGroup(chapter.id)
  // 路线图 §9：Search 章 53 张拆两片（主卡 36 / 面 17）；其余章 ≤ 50，单列一片。
  if (records.length > 50) {
    return {
      chapterId: chapter.id,
      pair: chapter.pair,
      part: chapter.part,
      shards: [
        { id: `M3-${chapter.id}`, codes: records.filter(isMain) },
        { id: `M3-${chapter.id}-faces`, codes: records.filter(isFace) },
      ],
    }
  }
  return {
    chapterId: chapter.id,
    pair: chapter.pair,
    part: chapter.part,
    shards: [{ id: `M3-${chapter.id}`, codes: records }],
  }
})
const sharedGroupRecords = SHARED_ENCOUNTER_GROUPS.flatMap(group => recordsOfGroup(group.id)).sort()
const investigatorRecords = [...packCodes.tdeInvestigators, ...faces.filter(face => face.pack === 'tdeInvestigators').map(face => face.code)].sort()
const shards = {
  investigators: {
    id: 'M1',
    codes: investigatorRecords,
    exemption: '调查员包按人整体切片：专属卡不可与调查员拆分，18 条记录低于 20–50 张/片的建议区间（路线图 §9 已记豁免理由）',
  },
  playerWaves,
  chapters: chapterShards,
  sharedGroups: [{ id: 'M3-shared-groups', codes: sharedGroupRecords }],
}
const shardIndex = [
  { id: shards.investigators.id, codes: shards.investigators.codes },
  ...shards.playerWaves,
  ...shards.chapters.flatMap(chapter => chapter.shards),
  ...shards.sharedGroups,
]
const shardSeen = new Map()
const shardOverlaps = []
for (const shard of shardIndex) {
  for (const code of shard.codes) {
    if (shardSeen.has(code)) shardOverlaps.push({ code, shards: [shardSeen.get(code), shard.id] })
    else shardSeen.set(code, shard.id)
  }
}
const shardMissing = [...mainCodes, ...faceCodes].filter(code => !shardSeen.has(code))

// ── 来源锁 ────────────────────────────────────────────────────────────────
const referencePaths = [
  // 卡表四份（卡号 / 卡文 / encounterCode 的原始事实源）
  `${REFERENCE_ROOT}/frontend/public/cards.json`,
  `${REFERENCE_ROOT}/frontend/public/cards_zh-cn.json`,
  `${REFERENCE_ROOT}/frontend/public/cards_zh.json`,
  `${REFERENCE_ROOT}/frontend/public/cards_en.json`,
  // 双战役后端（6 个）
  ...['CampaignSteps', 'ChaosBag', 'Helpers', 'Import', 'Key', 'Meta'].map(name =>
    `${REFERENCE_ROOT}/backend/arkham-api/library/Arkham/Campaigns/TheDreamEaters/${name}.hs`),
  // 双战役主流程（1 个，845 行）
  `${REFERENCE_ROOT}/backend/arkham-api/library/Arkham/Campaign/Campaigns/TheDreamEaters.hs`,
  // 8 章剧本（8 个）
  ...Object.values(SCENARIO_HS_FILES).map(name =>
    `${REFERENCE_ROOT}/backend/arkham-api/library/Arkham/Scenario/Scenarios/TheDreamEaters/${name}`),
  // 英文剧情（自译底本，9 个）+ 中文剧情（不完整，9 个）+ 中文记录标签（1 个）
  `${REFERENCE_ROOT}/frontend/src/locales/en/theDreamEaters/base.json`,
  ...chapters.map(chapter => `${REFERENCE_ROOT}/frontend/src/locales/en/theDreamEaters/scenarios/${chapter.id}.json`),
  `${REFERENCE_ROOT}/frontend/src/locales/zh/theDreamEaters/base.json`,
  ...chapters.map(chapter => `${REFERENCE_ROOT}/frontend/src/locales/zh/theDreamEaters/scenarios/${chapter.id}.json`),
  `${REFERENCE_ROOT}/frontend/src/locales/zh/campaignLog.json`,
]
const repoPaths = [
  'src/cards/cards-data.js',
  'content/packs/tdeCampaign/manifest.js',
  'content/packs/tdeInvestigators/manifest.js',
  'content/packs/tdePlayer/manifest.js',
  'content/campaigns/theDreamEaters/shared.js',
]
const sources = [
  ...referencePaths.map(path => ({ path, kind: 'reference', ...sha256(path, WORKSPACE_ROOT) })),
  ...repoPaths.map(path => ({ path, kind: 'repo', ...sha256(path) })),
]
const missingSources = sources.filter(source => !source.exists).map(source => source.path)

// ── 基线：规则版本 + golden replay + replay-before 一致性 ───────────────────
const readJson = relativePath => (existsSync(`${MOD_ROOT}${relativePath}`)
  ? JSON.parse(readFileSync(`${MOD_ROOT}${relativePath}`, 'utf8')) : null)
const golden = readJson(GOLDEN_FILE)
const replayBefore = readJson(REPLAY_BEFORE_FILE)
const counters = fixtures => fixtures ? {
  fixtures: fixtures.length,
  steps: fixtures.reduce((sum, fixture) => sum + (fixture.log?.moves?.length ?? 0), 0),
  hashes: fixtures.reduce((sum, fixture) => sum + (fixture.hashes || []).length, 0),
} : null
const goldenCounts = counters(golden?.fixtures)
const replayCounts = counters(replayBefore?.fixtures)
const replayIdsMatch = Boolean(golden && replayBefore)
  && golden.fixtures.map(fixture => fixture.id).join('|') === replayBefore.fixtures.map(fixture => fixture.id).join('|')
const replayHashesMatch = Boolean(golden && replayBefore)
  && golden.fixtures.map(fixture => (fixture.hashes || []).join(',')).join(';')
    === replayBefore.fixtures.map(fixture => (fixture.hashes || []).join(',')).join(';')

// ── 其余 M0 事实 ──────────────────────────────────────────────────────────
const recordsWithRemoteImage = [...mainCodes, ...faceCodes]
  .filter(code => Boolean(ALL_CARDS[code].imagesrc)).length
const registeredSource = existsSync(`${MOD_ROOT}content/registered.js`)
  ? readFileSync(`${MOD_ROOT}content/registered.js`, 'utf8') : ''
const runtimeRegistered = /(?:theDreamEaters|tdeCampaign|tdeInvestigators|tdePlayer)/.test(registeredSource)
const pairs = Array.from({ length: PAIR_COUNT }, (_, index) => {
  const pair = index + 1
  const inPair = chapterLedger.filter(chapter => chapter.pair === pair)
  return { pair, chapters: inPair.map(chapter => chapter.id), parts: [...new Set(inPair.map(chapter => chapter.part))].sort() }
})
const gitHead = (() => {
  const run = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: MOD_ROOT, encoding: 'utf8' })
  return run.status === 0 ? run.stdout.trim() : null
})()

const pending = [
  {
    id: 'beyondTheGatesOfSleepEncounterDeck',
    status: 'pending',
    evidence: '参考实现 BeyondTheGatesOfSleep.hs 有 gatherSets 声明但没有任何 gather Set.* 调用；英文规则书 setup 文本待 M3 逐句对齐（路线图 R8）',
  },
  {
    id: 'achievements',
    status: 'pending',
    evidence: '成就（achievements）默认 out-of-scope（决策 D4 未改口径），M3 前不列入机制条目',
  },
]

// ── gate ─────────────────────────────────────────────────────────────────
const sum = values => values.reduce((total, value) => total + value, 0)
const chapterGroupRecords = encounterGroups.filter(group => group.kind === 'chapter')
const sharedGroupRecordsList = encounterGroups.filter(group => group.kind === 'shared')
const uniqueGroups = new Set(ENCOUNTER_GROUP_IDS).size === ENCOUNTER_GROUP_IDS.length
const gate = {
  records: {
    total: mainCodes.length + faceCodes.length,
    assigned: sum(Object.values(packStats).map(pack => pack.records)),
    pass: mainCodes.length + faceCodes.length === EXPECTED.records
      && sum(Object.values(packStats).map(pack => pack.records)) === EXPECTED.records,
  },
  mainCodes: {
    total: mainCodes.length,
    assigned: mainCodes.length - unassignedMains.length,
    unknown: unknownOwned.length,
    pass: mainCodes.length === EXPECTED.main && unassignedMains.length === 0 && unknownOwned.length === 0,
  },
  faces: {
    total: faceCodes.length,
    assigned: faces.filter(face => face.pack).length,
    overrides: faces.filter(face => face.source === 'override').length,
    pass: faceCodes.length === EXPECTED.faces && unassignedFaces.length === 0,
  },
  packCounts: {
    ...Object.fromEntries(Object.entries(packStats).map(([pack, stats]) => [pack, stats.records])),
    pass: Object.entries(EXPECTED.packRecords).every(([pack, records]) => packStats[pack].records === records)
      && Object.entries(EXPECTED.packMain).every(([pack, main]) => packStats[pack].main === main)
      && Object.entries(EXPECTED.packFaces).every(([pack, face]) => packStats[pack].faces === face),
  },
  chapterGroups: {
    total: chapterGroupRecords.length,
    records: sum(chapterGroupRecords.map(group => group.records)),
    pass: chapterGroupRecords.length === EXPECTED.chapterGroups
      && sum(chapterGroupRecords.map(group => group.records)) === EXPECTED.chapterRecords,
  },
  sharedGroups: {
    total: sharedGroupRecordsList.length,
    records: sum(sharedGroupRecordsList.map(group => group.records)),
    pass: sharedGroupRecordsList.length === EXPECTED.sharedGroups
      && sum(sharedGroupRecordsList.map(group => group.records)) === EXPECTED.sharedRecords,
  },
  encounterGroups: {
    total: ENCOUNTER_GROUP_IDS.length,
    unique: uniqueGroups,
    totalRecords: sum(encounterGroups.map(group => group.records)),
    unmapped: [...unmappedDataGroups],
    missingFromShared,
    pass: ENCOUNTER_GROUP_IDS.length === EXPECTED.encounterGroups && uniqueGroups
      && unmappedDataGroups.size === 0 && missingFromShared.length === 0
      && sum(encounterGroups.map(group => group.records)) === EXPECTED.campaignRecords,
  },
  chapterPairs: {
    total: pairs.length,
    complete: pairs.filter(pair => pair.parts.length === 2).length,
    pass: pairs.length === PAIR_COUNT && pairs.every(pair => pair.parts.length === 2),
  },
  printPacks: {
    ...Object.fromEntries(Object.keys(EXPECTED.printPacks).map(pack => [pack,
      [...mainCodes, ...faceCodes].filter(code => ALL_CARDS[code].pack === pack).length])),
    pass: Object.entries(EXPECTED.printPacks).every(([pack, count]) =>
      [...mainCodes, ...faceCodes].filter(code => ALL_CARDS[code].pack === pack).length === count),
  },
  shards: {
    total: shardIndex.length,
    assigned: shardSeen.size,
    overlaps: shardOverlaps.length,
    missing: shardMissing.length,
    pass: shardOverlaps.length === 0 && shardMissing.length === 0
      && shardSeen.size === EXPECTED.records,
  },
  sources: {
    total: sources.length,
    present: sources.length - missingSources.length,
    missing: missingSources,
    pass: sources.length === EXPECTED.sources && missingSources.length === 0,
  },
  baseline: {
    rulesVersion: RULES_VERSION,
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    replayBefore: Boolean(replayBefore),
    idsMatch: replayIdsMatch,
    hashesMatch: replayHashesMatch,
    pass: Boolean(replayBefore) && replayIdsMatch && replayHashesMatch
      && JSON.stringify(replayCounts) === JSON.stringify(goldenCounts)
      && replayCounts?.fixtures === 13 && replayCounts?.steps === 786 && replayCounts?.hashes === 799,
  },
  crossCycleGroups: {
    total: crossCycleGroups.length,
    present: crossCycleGroups.filter(group => group.repoDirExists).length,
    missing: crossCycleGroups.filter(group => !group.repoDirExists).map(group => group.id),
    pass: crossCycleGroups.every(group => group.repoDirExists),
  },
  unownedFaces: {
    overrides: Object.keys(UNOWNED_FACE_OVERRIDES),
    assigned: Object.keys(UNOWNED_FACE_OVERRIDES).filter(code => Boolean(facePackOf(code))).length,
    pass: Object.keys(UNOWNED_FACE_OVERRIDES).every(code => Boolean(facePackOf(code)))
      && faces.filter(face => face.source === 'override' && face.agreesWithEncounterCode === false).length === 0,
  },
  catalogOnly: {
    registered: runtimeRegistered,
    pass: !runtimeRegistered,
  },
}

const scope = {
  schemaVersion: 1,
  cycle: 'tde',
  cycleName: 'The Dream Eaters',
  cycleNameZh: '食梦者',
  milestone: 'M0',
  step: 'P1 范围与来源锁',
  generatedBy: 'tools/scan-tde-scope.mjs',
  docs: 'docs/tde-migration-roadmap.md',
  counts: {
    main: mainCodes.length,
    faces: faceCodes.length,
    records: mainCodes.length + faceCodes.length,
    packs: Object.fromEntries(Object.entries(packStats).map(([pack, stats]) => [pack, stats.records])),
    chapters: chapters.length,
    encounterGroups: ENCOUNTER_GROUP_IDS.length,
    parts: Object.keys(PARTS).length,
    pairs: PAIR_COUNT,
    modes: MODES.length,
  },
  modes: [...MODES],
  parts: Object.values(PARTS).map(part => ({ ...part, chapters: chapters.filter(chapter => chapter.part === part.id).map(chapter => chapter.id) })),
  pairs,
  packs: Object.entries(packStats).map(([id, stats]) => ({ id, ...stats })),
  faces,
  unassigned: { main: unassignedMains, faces: unassignedFaces.map(face => face.code) },
  encounterGroups,
  chapters: chapterLedger,
  crossCycleGroups,
  gatherRefs,
  shards,
  sources,
  baseline: {
    rulesVersion: RULES_VERSION,
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    goldenReplay: goldenCounts,
    replayBefore: replayCounts,
    replayBeforeSha256: sha256(REPLAY_BEFORE_FILE).sha256,
    replayBeforeIdsMatch: replayIdsMatch,
    replayBeforeHashesMatch: replayHashesMatch,
    git: {
      head: gitHead,
      note: '提交会变，基线提交另存 artifacts/migration/tde/reports/baseline-git-head.txt；本账本不把 gitHead 纳入比对',
    },
  },
  cardImages: {
    remoteFallbackFields: ['imagesrc', 'backimagesrc'],
    recordsWithRemoteImage,
    note: '本地卡图属于被忽略的本地缓存（web/img/**），不计入账本；缺图清单见 reports/image-inventory.json',
  },
  pending,
  gate: { ...gate, pass: Object.values(gate).every(entry => entry.pass) },
}

// ── 任务 12：本地卡图库存（M0 附加动作，不写进 scope.json）─────────────────
// 本地卡图缓存整体被 .gitignore 忽略（web/img/**），所以缺图数不是仓库缺陷，
// 也不该进可复算账本；这里单独出一份清单，供远程回退与展示素材核对。
const IMAGE_DIRS = Object.freeze({ en: 'web/img/cards', zh: 'web/img/zh/cards' })
const IMAGE_EXTENSIONS = Object.freeze(['avif', 'png', 'jpg', 'jpeg', 'webp'])

function scanImageDir(relativeDir) {
  const absolute = `${MOD_ROOT}${relativeDir}`
  const byCode = new Map()
  if (!existsSync(absolute)) return { dir: relativeDir, dirExists: false, files: 0, byCode }
  for (const name of readdirSync(absolute)) {
    const match = /^(06\d{3}[a-z]?)\.([a-z]+)$/.exec(name)
    if (!match || !IMAGE_EXTENSIONS.includes(match[2])) continue
    if (!byCode.has(match[1])) byCode.set(match[1], match[2])
  }
  return { dir: relativeDir, dirExists: true, files: byCode.size, byCode }
}

function buildImageInventory() {
  const records = [...mainCodes, ...faceCodes].sort()
  const dirs = Object.fromEntries(Object.entries(IMAGE_DIRS).map(([locale, dir]) => {
    const scan = scanImageDir(dir)
    const missing = records.filter(code => !scan.byCode.has(code))
    return [locale, {
      dir,
      dirExists: scan.dirExists,
      files: scan.files,
      covered: records.length - missing.length,
      missing: missing.length,
      missingCodes: missing,
      extensions: [...new Set([...scan.byCode.values()])].sort(),
    }]
  }))
  return {
    schemaVersion: 1,
    cycle: 'tde',
    generatedBy: 'node tools/scan-tde-scope.mjs --images',
    note: '本地卡图缓存整体被忽略（web/img/**），缺图不计入仓库门禁；本清单只服务 M0 缺图核对与远程回退确认。',
    records: records.length,
    remoteFallback: {
      fields: ['imagesrc', 'backimagesrc'],
      recordsWithRemoteImage,
      availableForAllRecords: recordsWithRemoteImage === records.length,
    },
    dirs,
  }
}

if (MODE === 'images') {
  const report = buildImageInventory()
  const target = 'artifacts/migration/tde/reports/image-inventory.json'
  mkdirSync(`${MOD_ROOT}artifacts/migration/tde/reports/`, { recursive: true })
  writeFileSync(`${MOD_ROOT}${target}`, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`image inventory: ${target}`)
  for (const [locale, info] of Object.entries(report.dirs)) {
    console.log(`  ${locale}: ${info.covered}/${report.records} 本地图（${info.dir}${info.dirExists ? '' : '，目录不存在'}），扩展名 ${info.extensions.join('/') || '—'}`)
  }
  console.log(`  远程回退 ${report.remoteFallback.fields.join(' / ')}：${report.remoteFallback.recordsWithRemoteImage}/${report.records} 条记录有远程图片`)
  process.exit(0)
}

const json = `${JSON.stringify(scope, null, 2)}\n`

if (MODE === 'write') {
  mkdirSync(`${MOD_ROOT}artifacts/migration/tde/`, { recursive: true })
  writeFileSync(`${MOD_ROOT}${SCOPE_FILE}`, json, 'utf8')
  console.log(`scope: ${SCOPE_FILE}`)
  console.log(`records ${scope.counts.records} = main ${scope.counts.main} + faces ${scope.counts.faces}; 三包 ${gate.packCounts.tdeCampaign}/${gate.packCounts.tdeInvestigators}/${gate.packCounts.tdePlayer}; 20 组 ${gate.encounterGroups.totalRecords} 张; gate ${scope.gate.pass ? 'pass' : 'fail'}`)
  for (const [key, value] of Object.entries(gate)) if (!value.pass) console.log(`  gate 未通过 ${key}: ${JSON.stringify(value)}`)
} else if (MODE === 'check') {
  if (!existsSync(`${MOD_ROOT}${SCOPE_FILE}`)) { console.error('scope.json 不存在：先运行 --write'); process.exit(1) }
  const disk = readFileSync(`${MOD_ROOT}${SCOPE_FILE}`, 'utf8')
  if (disk !== json) { console.error('scope.json 与来源不一致（重新 --write 并审阅 diff）'); process.exit(1) }
  if (!scope.gate.pass) { console.log(JSON.stringify(scope.gate, null, 2)); process.exit(1) }
  console.log(`scope 复算一致：${scope.counts.records} 条记录（${scope.counts.main} 主卡 + ${scope.counts.faces} 面），三包 ${gate.packCounts.tdeCampaign}/${gate.packCounts.tdeInvestigators}/${gate.packCounts.tdePlayer}，20 个遭遇组，8 章，${sources.length} 个来源`)
} else {
  console.log(json)
}
