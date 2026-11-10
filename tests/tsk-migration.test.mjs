// 八循环《绯红密钥》（The Scarlet Keys，TSK）P0 范围与基线回归。
//
// P0（M0）只锁定范围与身份，不做任何行为迁移：
//   · scope 账本（audit/tsk-scope.json）必须由 tools/scan-tsk-scope.mjs#buildScope() 逐字节复算，
//     基线（audit/tsk-baseline.json）锁定起始提交、既有失败、工作区既有改动与 golden replay 指纹；
//   · 三个内容包都是 catalog-only：战役与十章占位不进生产组合根，大厅不出现、不可启动、不可构筑；
//   · 10 章专属遭遇组 + 16 个跨章共享组无交集地覆盖 26 组，三包分区 311/20/108 无重叠无遗漏；
//   · 10 把双面绯红密钥、16 张定制升级卡、四档混乱袋、36 节点世界地图、状况报告 α–ω、
//     17 段幕间（1 + 14–55）、尾声分支与禁用卡规则全部从参考实现复算。
//
// 后续里程碑（P1 机制扫描 → P8 发布）沿用同一文件追加断言，与 tests/eote-migration.test.mjs 同一模式。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildScope } from '../tools/scan-tsk-scope.mjs'
import { buildScan } from '../tools/scan-tsk-mechanisms.mjs'
import { buildGuides, buildStoryScan, TSK_GUIDE_LAYERS, normalizeArchiveLabel } from '../tools/tsk-guide-scan.mjs'
import { BLOCKED_PRIMITIVES, ENGINE_INVENTORY, KEY_MECHANISMS, PRIMITIVE_CATALOG } from '../tools/tsk-mechanism-primitives.mjs'
import { MECHANISM_TYPES } from '../tools/tsk-mechanisms.mjs'
import { json, readJson, sha, sourceLock, MOD } from '../tools/tsk-migration-lib.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES_VERSION, STATE_SCHEMA_VERSION } from '../src/engine/rules-state.js'
import {
  CAMPAIGN_ID, CARD_PARTITIONS, CHAOS_BAGS, CHAPTER_ENCOUNTER_GROUPS, CYCLE_CODES, CUSTOMIZABLE_CODES,
  ENCOUNTER_GROUPS, GREEN_LOCATIONS, INITIAL_UNLOCKED, INTERLUDES, INVESTIGATOR_CODES, KEY_CARDS,
  SCENARIO_REFERENCE_CODES, SHARED_ENCOUNTER_GROUPS, SIGNATURE_CODES, WORLD_MAP, WORLD_MAP_IDS, chapters,
} from '../content/campaigns/theScarletKeys/shared.js'
import { catalogChapters } from '../content/campaigns/theScarletKeys/chapters.js'
import { manifest } from '../content/campaigns/theScarletKeys/manifest.js'
import { manifest as campaignPackManifest } from '../content/packs/tskCampaign/manifest.js'
import { manifest as investigatorsPackManifest } from '../content/packs/tskInvestigators/manifest.js'
import { manifest as playerPackManifest } from '../content/packs/tskPlayer/manifest.js'
import { campaignListForUi, createContentRegistry } from '../content/registry.js'
import { contentRegistry } from '../content/registered.js'
import { assertCampaignManifest, assertPackManifest } from '../content/schema.js'
import { getAvailability } from '../src/deck/availability.js'

const isFace = code => /[a-z]$/.test(code)
const isMain = code => /^\d{5}$/.test(code)
const CHAPTER_IDS = chapters.map(chapter => chapter.id)
const PACK_IDS = ['tskCampaign', 'tskInvestigators', 'tskPlayer']
const PACK_CARD_COUNTS = Object.freeze({ tskCampaign: 311, tskInvestigators: 20, tskPlayer: 108 })
const EXTERNAL_ENCOUNTER_SETS = Object.freeze([
  'AncientEvils', 'ChillingCold', 'DarkCult', 'Ghouls', 'LockedDoors', 'Nightgaunts', 'StrikingFear', 'TheMidnightMasks',
])
// 三包分区键：脚本用包 id，本地断言按角色语义做一次兼容读取。
const PARTITION_KEYS = Object.freeze({
  tskCampaign: ['tskCampaign', 'campaign'],
  tskInvestigators: ['tskInvestigators', 'investigators'],
  tskPlayer: ['tskPlayer', 'player'],
})
function partitionCodes(scope, id) {
  for (const key of PARTITION_KEYS[id]) if (Array.isArray(scope.partitions?.[key])) return scope.partitions[key]
  return null
}
// 章节条目必须带真实提示卡身份（印刷剧本身份卡类型是 scenario）。
function promptCardOf(chapter) {
  for (const key of ['promptCard', 'referenceCard', 'reference']) {
    const value = chapter[key]
    if (value && typeof value === 'object' && typeof value.type === 'string') return value
  }
  return null
}
// P0 生产组合根只登记三个 catalog-only 内容包：战役清单与十章占位**刻意不注册**，
// 避免未开放内容进入大厅/音乐/指南流程（与 TIC/EotE 迁移路径一致）。战役/章节身份用本地注册表复算。
function localTskRegistry() {
  return createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [manifest],
    scenarios: catalogChapters,
  })
}

test('P0 范围账本：439 条记录三包守恒、来源锁定、十章身份与四档混乱符号可复算', () => {
  const scope = buildScope()
  const failed = Object.entries(scope.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `范围门禁失败：${failed.join(', ')}`)
  assert.equal(json(scope), readFileSync(new URL('../audit/tsk-scope.json', import.meta.url), 'utf8'),
    'scope 账本必须由 buildScope() 逐字节复算（--check 口径）')

  // 计数：369 主卡 + 70 关联面 = 439 条印刷记录、398 个物理卡位；三包 311/20/108。
  assert.deepEqual(scope.counts.packs, PACK_CARD_COUNTS)
  assert.equal(scope.counts.records, 439)
  assert.equal(scope.counts.main, 369)
  assert.equal(scope.counts.faces, 70)
  assert.equal(scope.counts.positions, 398)
  assert.equal(scope.counts.records, scope.counts.main + scope.counts.faces, '主卡 + 关联面必须等于记录总数')
  assert.equal(scope.counts.chapters, 10)
  assert.equal(scope.counts.encounterGroups, 26)
  assert.equal(scope.counts.sharedGroups, 16)
  assert.equal(scope.counts.chapterGroups, 10)
  assert.equal(scope.counts.investigators, INVESTIGATOR_CODES.length)
  assert.equal(scope.counts.signatures, SIGNATURE_CODES.length)
  assert.equal(scope.counts.keys, 10)
  assert.equal(scope.counts.keyRecords, 20)
  assert.equal(scope.counts.customizable, CUSTOMIZABLE_CODES.length)
  assert.equal(scope.counts.concealedKinds, 29)
  assert.equal(scope.counts.reprintGroups, 6)
  assert.equal(scope.counts.crossCycleReprints, 2)
  assert.equal(scope.counts.externalSets, EXTERNAL_ENCOUNTER_SETS.length)
  assert.equal(scope.counts.worldMapNodes, 36)
  assert.equal(scope.counts.statusReports, 6)
  assert.equal(scope.counts.campaignSteps, 10)
  assert.equal(scope.counts.travelDestinations, 36)
  assert.equal(scope.counts.interludes, 17)
  assert.equal(scope.counts.redCoterie, 10)

  // 卡号全集：每条记录都恰好归属一个内容包，分区无交集、并集守恒为 CYCLE_CODES。
  assert.equal(scope.cards.length, CYCLE_CODES.length)
  for (const card of scope.cards) assert.ok(PACK_IDS.includes(card.owner), `${card.code} 的 owner 非法：${card.owner}`)
  const flat = PACK_IDS.flatMap(id => partitionCodes(scope, id) || [])
  assert.equal(flat.length, CYCLE_CODES.length, '三包分区合计必须等于记录总数')
  assert.equal(new Set(flat).size, flat.length, '三包分区不得重叠')
  assert.deepEqual([...flat].sort(), [...CYCLE_CODES], '三包分区并集必须覆盖全部印刷记录')
  for (const id of PACK_IDS) {
    const codes = partitionCodes(scope, id)
    assert.ok(codes, `scope.partitions 缺少 ${id}`)
    assert.equal(codes.length, PACK_CARD_COUNTS[id], `${id} 分区卡数不对`)
    assert.deepEqual([...codes].sort(), [...CARD_PARTITIONS[id]].sort(), `${id} 分区内容与 shared.js 不一致`)
  }

  // 双面绯红密钥：10 把，a=Stable / b=Unstable，a→b 关联，参考定义与卡表名称一致，且都有发放点。
  const keys = scope.cards.filter(card => card.type === 'key')
  assert.equal(keys.length, 20)
  assert.equal(scope.keyCards.length, 10)
  for (const key of scope.keyCards) {
    assert.ok(KEY_CARDS.some(entry => entry.id === key.id && entry.stableCode === key.stableCode && entry.unstableCode === key.unstableCode))
    assert.ok(key.stableTraits.includes('Stable'), `${key.id} 稳定面 traits 不对`)
    assert.ok(key.unstableTraits.includes('Unstable'), `${key.id} 动荡面 traits 不对`)
    assert.equal(ALL_CARDS[key.stableCode].linkedToCode, key.unstableCode)
    assert.equal(key.referenceDefinition?.name, key.name)
    assert.ok(key.awards.length > 0, `${key.id} 没有任何发放点`)
  }
  // 参考 Key/Cards.hs 的 88045（The Wellspring of Fortune）属 fof 独立冒险包，只登记为范围外依赖。
  assert.equal(scope.externalKeyCards.length, 1)
  assert.equal(scope.externalKeyCards[0].id, '88045')
  assert.equal(scope.externalKeyCards[0].inCycle, false)

  // 定制升级卡：勾选项（□ 数量）逐卡解析，经验值来自勾选数，卡表 xp=0。
  assert.equal(scope.customizableCards.length, 16)
  for (const card of scope.customizableCards) {
    assert.ok(card.optionCount > 0, `${card.code} 没有勾选项`)
    assert.equal(card.checkboxCount, card.totalChecks, `${card.code} 勾选框总数与选项不一致`)
    assert.equal(card.xp, 0, `${card.code} 定制卡印刷经验应为 0`)
    assert.ok(card.options.every(option => option.checks >= 1 && option.name && option.text))
  }

  // 多记录卡位：密钥两面 / 关联对 / 变体卡分类；每个关联面都落在同归属卡位里。
  assert.equal(scope.multiRecordPositions.length, 32)
  assert.equal(scope.multiRecordPositions.filter(entry => entry.kind === 'key-stable-unstable').length, 10)
  assert.equal(scope.multiRecordPositions.filter(entry => entry.kind === 'variants').length, 7)
  assert.equal(scope.linkedPairs.length, 28)
  assert.deepEqual(scope.orphanFaceCodes, ['09606a'])

  // 重印：跨循环同印刷身份 2 组（canonical 取最小卡号），本循环内 4 组变体另行登记。
  const crossCycle = scope.crossCycleReprints.map(group => group.codes.join('|')).sort()
  assert.deepEqual(crossCycle, ['04096|09587', '09064|12049'])
  for (const group of scope.reprintGroups) {
    assert.ok(group.codes.includes(group.canonicalCode), `重印组 ${group.canonicalCode} 缺少 canonical 自身`)
    assert.ok(group.codes.every(code => ALL_CARDS[code]), '重印组包含卡池之外的卡号')
  }
  // canonical 方向：09587（tskc）复用 04096（tfa）实现；09064（tskp）是 12049（core_2026）的规范实现。
  const cardByCode = new Map(scope.cards.map(card => [card.code, card]))
  assert.equal(cardByCode.get('09587').canonicalCode, '04096')
  assert.equal(cardByCode.get('09064').canonicalCode, '09064')

  // 十章身份：顺序、真实提示卡、档案编号、中英指南来源（带 SHA-256）都必须锁定。
  assert.equal(scope.chapters.length, chapters.length)
  assert.deepEqual(scope.chapters.map(chapter => chapter.id), CHAPTER_IDS, '十章顺序必须与 shared.js 一致')
  assert.deepEqual(scope.chapters.map(chapter => chapter.stepId),
    ['09501', '09520', '09545', '09566', '09591', '09609', '09635', '09660', '09681', '09694'])
  assert.deepEqual([...SCENARIO_REFERENCE_CODES].sort(), ['09501', '09520', '09545', '09566', '09591', '09609', '09635', '09660', '09681', '09694'].sort())
  for (const [index, chapter] of scope.chapters.entries()) {
    const printed = chapters[index]
    assert.equal(chapter.referenceCode, printed.referenceCode, `${chapter.id} 的提示卡号不对`)
    assert.equal(chapter.mapLocationId, printed.mapLocationId, `${chapter.id} 的地图节点不对`)
    assert.equal(chapter.archiveLabel, printed.archiveLabel)
    assert.equal(chapter.archiveLabelMatched, true, `${chapter.id} 的档案编号 ${chapter.archiveLabel} 未在参考指南/地图中找到`)
    // 四档混乱符号规则：提示卡正面 = Easy / Standard，背面 = Hard / Expert，符号规则逐字锁定。
    const prompt = promptCardOf(chapter)
    assert.ok(prompt, `${chapter.id} 缺少提示卡身份`)
    assert.equal(prompt.type, 'scenario', `${chapter.id} 的提示卡不是剧本卡`)
    assert.match(prompt.text, /^Easy \/ Standard/)
    assert.match(prompt.backText, /^Hard \/ Expert/)
    assert.match(prompt.text, /\[skull\]/)
    assert.match(prompt.backText, /\[skull\]/)
    assert.equal(chapter.guideSources.length, 2, `${chapter.id} 必须锁定中英两份指南来源`)
    for (const source of chapter.guideSources) {
      assert.match(source.sha256, /^[0-9a-f]{64}$/, `${chapter.id} 指南来源缺少 SHA-256`)
      assert.ok(source.keyCount > 0, `${chapter.id} 指南来源没有段落键`)
    }
  }

  // 遭遇组：10 章专属 + 16 跨章共享，无交集覆盖 26 组，组卡合计 311。
  assert.equal(scope.encounterGroups.length, 26)
  assert.equal(scope.encounterGroups.filter(group => group.kind === 'chapter').length, 10)
  assert.equal(scope.encounterGroups.filter(group => group.kind === 'shared').length, 16)
  assert.equal(scope.encounterGroups.reduce((total, group) => total + group.records, 0), 311)
  for (const chapter of chapters) {
    assert.ok(CHAPTER_ENCOUNTER_GROUPS[chapter.id], `章节 ${chapter.id} 没有归属遭遇组`)
    assert.ok(scope.encounterGroups.some(group => group.id === CHAPTER_ENCOUNTER_GROUPS[chapter.id] && group.chapterId === chapter.id))
  }
  assert.deepEqual([...Object.values(CHAPTER_ENCOUNTER_GROUPS), ...SHARED_ENCOUNTER_GROUPS].sort(), [...ENCOUNTER_GROUPS].sort())
  assert.deepEqual(Object.values(CHAPTER_ENCOUNTER_GROUPS).filter(group => SHARED_ENCOUNTER_GROUPS.includes(group)), [])

  // 四类集合：调查员 / 一般玩家卡 / 共享组 / 章节组，无重叠、并集 = 439。
  const setCodes = [
    ...scope.sets.investigators.codes,
    ...scope.sets.player.codes,
    ...scope.sets.sharedGroups.flatMap(group => group.codes),
    ...scope.sets.chapterGroups.flatMap(group => group.codes),
  ]
  assert.equal(setCodes.length, CYCLE_CODES.length)
  assert.equal(new Set(setCodes).size, setCodes.length)
  assert.deepEqual([...setCodes].sort(), [...CYCLE_CODES].sort())

  // 跨循环依赖：核心遭遇组只登记依赖，不重复归入本循环；每个依赖都要有卡号与使用章节。
  for (const name of EXTERNAL_ENCOUNTER_SETS) {
    const dependency = scope.externalDependencies.find(entry => entry.set === name)
    assert.ok(dependency, `缺少跨循环依赖 ${name}`)
    assert.ok(dependency.codes.length > 0, `${name} 没有登记可复用的卡号`)
    assert.ok(dependency.usedBy.length > 0, `${name} 没有登记使用章节`)
    assert.equal(dependency.repoDirExists, true, `${name} 的复用目录不存在`)
    for (const chapterId of dependency.usedBy) assert.ok(CHAPTER_IDS.includes(chapterId), `${name} 的 usedBy 含未知章节 ${chapterId}`)
  }
  // 子集口径：StrikingFear 只取 Frozen in Fear / Dissonant Voices；TheMidnightMasks 只取两张。
  assert.deepEqual(scope.externalDependencies.find(entry => entry.set === 'StrikingFear').subsetCodes, ['01164', '01165'])
  assert.deepEqual(scope.externalDependencies.find(entry => entry.set === 'TheMidnightMasks').subsetCodes, ['01135', '01136'])

  // 混乱袋四档：没有 cultist（由状况报告追加），符号齐全，张数 16/16/17/18。
  assert.deepEqual(scope.chaosBags, CHAOS_BAGS, 'scope 混乱袋必须与 shared.js 一致')
  const sizes = Object.fromEntries(Object.entries(CHAOS_BAGS).map(([tier, tokens]) => [tier, tokens.length]))
  assert.deepEqual(sizes, { easy: 16, standard: 16, hard: 17, expert: 18 })
  for (const tier of ['easy', 'standard', 'hard', 'expert']) {
    for (const token of ['skull', 'tablet', 'elderthing', 'autofail', 'eldersign']) {
      assert.ok(CHAOS_BAGS[tier].includes(token), `${tier} 混乱袋缺少 ${token}`)
    }
    assert.equal(CHAOS_BAGS[tier].includes('cultist'), false, `${tier} 混乱袋不应包含 cultist`)
  }
  // 状况报告 α/ε/β/ζ/γ/ω 的阈值与效果（加 cultist、解锁、偷钥匙、加诡计）逐项锁定。
  assert.deepEqual(scope.campaignFlow.statusReports, [
    { report: 'alpha', threshold: 7 }, { report: 'epsilon', threshold: 10 }, { report: 'beta', threshold: 15 },
    { report: 'zeta', threshold: 20 }, { report: 'gamma', threshold: 24 }, { report: 'omega', threshold: 35 },
  ])
  assert.deepEqual(scope.campaignFlow.dynamicStatusReports, ['theta', 'psi'])
  assert.deepEqual(scope.campaignFlow.statusReportEffects.alpha.chaosTokens, ['cultist'])
  assert.deepEqual(scope.campaignFlow.statusReportEffects.beta.unlocks, ['Tunguska'])
  assert.deepEqual(scope.campaignFlow.statusReportEffects.zeta.unlocks, ['Kabul', 'Quito', 'Reykjavik', 'SanJuan'])
  assert.equal(scope.campaignFlow.statusReportEffects.zeta.stealsKeys, true)
  assert.deepEqual(scope.campaignFlow.statusReportEffects.gamma.deckTreacheries, ['paradimensionalUnderstanding'])
  assert.deepEqual(scope.campaignFlow.statusReportEffects.psi.unlocks, ['HongKong'])

  // 世界地图：36 节点、连接双向对称、5 绿地、26 初始解锁、起点伦敦、全部节点可达。
  assert.equal(scope.worldMap.nodes.length, 36)
  assert.equal(scope.worldMap.connectionsValid, true)
  assert.equal(scope.worldMap.connectionsSymmetric, true)
  assert.deepEqual(scope.worldMap.greenLocations, [...GREEN_LOCATIONS])
  assert.equal(scope.worldMap.startLocation, 'London')
  assert.equal(scope.worldMap.initialUnlocked.length, INITIAL_UNLOCKED.length)
  assert.equal(INITIAL_UNLOCKED.length, 26)
  assert.equal(Object.values(scope.worldMap.distancesFromStart).filter(value => value === null).length, 0, '存在不可达地图节点')
  assert.deepEqual([...WORLD_MAP_IDS].sort(), scope.worldMap.nodes.map(node => node.id).sort())
  assert.deepEqual([...WORLD_MAP].map(node => node.id).sort(), [...WORLD_MAP_IDS].sort())

  // 战役流程：10 个 ScenarioStep、出发/旅行目的地（36 个节点全覆盖）、禁用卡 02310 与尾声分支。
  assert.equal(scope.campaignFlow.steps.length, 10)
  assert.deepEqual(scope.campaignFlow.steps.map(step => step.stepId),
    ['09501', '09520', '09545', '09566', '09591', '09609', '09635', '09660', '09681', '09694'])
  assert.equal(scope.campaignFlow.steps.map(step => step.id).join('|'), CHAPTER_IDS.join('|'))
  assert.equal(scope.campaignFlow.travelDestinations.length, 36)
  assert.equal(scope.campaignFlow.travelRules.forcedTunguskaAt, 35)
  assert.deepEqual(scope.campaignFlow.invalidCards.codes, ['02310'])
  assert.equal(scope.campaignFlow.invalidCards.erasedFromExistenceRule, true)
  assert.equal(scope.campaignFlow.epilogue.trustRecords.length, 3)
  assert.equal(scope.campaignFlow.epilogue.deceptionRecords.length, 8)
  assert.equal(scope.campaignFlow.epilogue.joinedCoterieRecord, 'TheRedCoterieAndTheCellAgreedToWorkTogether')
  assert.equal(scope.campaignFlow.epilogue.permanentPositionRecord, 'TheCellWasGivenAPermanentPosition')
  assert.equal(scope.campaignFlow.epilogue.dismantledRecord, 'TheCellWasDismantled')
  // 17 段幕间（1 + 14–55）：编号 / scope / 中英名称 / 触发节点 / 档案编号全部锁定。
  assert.equal(scope.campaignFlow.interludes.length, 17)
  assert.deepEqual(scope.campaignFlow.interludes.map(entry => entry.number),
    [1, 14, 20, 26, 27, 32, 36, 37, 44, 45, 49, 50, 51, 52, 53, 54, 55])
  for (const entry of scope.campaignFlow.interludes) {
    assert.ok(entry.nameEn, `幕间 ${entry.number} 缺少英文名`)
    assert.ok(entry.nameZh, `幕间 ${entry.number} 缺少中文名`)
    assert.ok(entry.scopeId, `幕间 ${entry.number} 缺少参考 scope`)
  }
  assert.deepEqual([...scope.campaignFlow.interludes.find(entry => entry.number === 14).triggerLocations].sort(),
    ['Kabul', 'Quito', 'Reykjavik', 'SanJuan'])
  assert.ok(INTERLUDES.every(entry => scope.campaignFlow.interludes.some(item => item.number === entry.number)))
  // 红色同志会：10 名核心成员与卡号一一对应；隐匿迷你卡 29 类（含 5 类诱饵）全部被参考实现引用。
  assert.equal(scope.campaignFlow.redCoterie.length, 10)
  assert.deepEqual(scope.campaignFlow.redCoterie.map(entry => entry.code).sort(),
    ['09752', '09753', '09754', '09755', '09756', '09757', '09758', '09759', '09760', '09761'])
  assert.equal(scope.campaignFlow.concealedMiniCards.kinds.length, 29)
  assert.deepEqual(scope.campaignFlow.concealedMiniCards.decoyKinds, ['Decoy', 'DecoyVoidChimeraEarsplitter', 'DecoyVoidChimeraFellbeak', 'DecoyVoidChimeraFellhound', 'DecoyVoidChimeraGorefeaster'])

  // 来源逐文件锁定：SHA-256 64 位十六进制且字节数非零（漂移后 --check 必须失败）。
  assert.equal(scope.sources.length, 427)
  for (const lock of scope.sources) {
    assert.match(lock.sha256, /^[0-9a-f]{64}$/, `${lock.path} 的 SHA-256 非法`)
    assert.ok(lock.bytes > 0, `${lock.path} 字节数为 0`)
  }
  assert.equal(scope.guideSources.length, 22)

  // 基线指针：scope 必须携带起始提交、既有失败与 replay 文件位置，供 P0 复现。
  assert.ok(scope.baseline && typeof scope.baseline === 'object')
  assert.match(scope.baseline.gitHead, /^[0-9a-f]{40}$/)
  assert.equal(scope.baseline.replayFile, 'tests/fixtures/replay/tsk-baseline.json')
  assert.ok(scope.baseline.fastFailures.length > 0)
})

test('P0 原始基线：起始提交、工作区既有改动、既有失败与 golden replay 指纹可复算', () => {
  const baseline = readJson(new URL('../audit/tsk-baseline.json', import.meta.url))
  assert.match(baseline.gitHead, /^[0-9a-f]{40}$/, '基线必须记录 40 位起始提交')
  assert.equal(typeof baseline.replayFile, 'string')
  // replay 指纹按记录时的文件字节复算：文件漂移即失败，不允许手写“已知哈希”。
  const replay = sourceLock(baseline.replayFile, MOD)
  assert.equal(replay.sha256, baseline.replaySha256, 'replay 基线文件已漂移或被手工改写')
  assert.ok(replay.bytes > 0)
  assert.equal(baseline.replaySummary.length, 13)
  assert.equal(baseline.replaySummary.reduce((total, fixture) => total + fixture.moves, 0), 797)
  // P0 开始时工作区带既有删除改动（docs/edgeOfTheEarth/** 45 个文件），必须如实登记。
  assert.ok(Array.isArray(baseline.worktree), 'worktree 必须是数组')
  assert.equal(baseline.worktree.length, 45)
  assert.ok(baseline.worktree.every(entry => entry.includes('docs/edgeOfTheEarth/')))
  // 既有失败按标题冻结，只用于区分「P0 之前就失败」与「本轮新增失败」，不能漏记。
  assert.ok(Array.isArray(baseline.fastFailures), 'fastFailures 必须是数组')
  assert.equal(baseline.fastFailures.length, 4)
  assert.deepEqual([...baseline.fastFailures].sort(), [
    'P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致',
    'P8 eote all-cards 两次构建一致且与账本一致',
    'P8 eote migration ledger · 确定性：导出 builder 两次深相等且与签入账本一致',
    '已本地化的 UI 文件不再残留用户可见中文',
  ].sort())
  // R1/R2/R3 合规基线与 12 项能力层指标嵌入基线，跨循环账本可复算。
  assert.ok(baseline.complianceBaseline && Array.isArray(baseline.complianceBaseline.directStateWrite))
  const metricKeys = ['engineCodes', 'effectsEntries', 'effectsTopLevelFields', 'escapeCards',
    'descriptorEntries', 'descriptorAbilities', 'abilityKinds', 'windows',
    'effectPrimitives', 'nonPlayerCards', 'behaviorLines', 'declaredScenarios']
  for (const key of metricKeys) assert.equal(Number.isInteger(baseline.architectureMetrics[key]), true, `缺少指标 ${key}`)
  // 规则/状态版本与当前源码一致（版本变化必须显式重签基线并审阅）。
  assert.equal(baseline.rulesVersion, RULES_VERSION)
  assert.equal(baseline.stateSchemaVersion, STATE_SCHEMA_VERSION)
})

test('P0 目录注册：三个 catalog-only 内容包进组合根，战役/十章/选人/构筑不因收录开放', () => {
  for (const id of PACK_IDS) {
    const pack = contentRegistry.getPack(id)
    const investigatorPack = id === 'tskInvestigators'
    assert.ok(pack, `${id} 应已注册进组合根`)
    assertPackManifest(pack)
    // P5：调查员包升级为 playable（只含 09001–09020）；战役包与玩家卡包仍 catalog-only。
    assert.equal(pack.status, investigatorPack ? 'playable' : 'catalog-only', `${id} 阶段状态不正确`)
    assert.equal(pack.cards.length, PACK_CARD_COUNTS[id], `${id} 卡数必须与 scope 分区一致`)
    assert.ok(pack.cards.every(card => card.cataloged === true
      && card.rulesImplemented === investigatorPack
      && card.deckbuilding === false),
      `${id} 收录不能冒充规则已实现或可构筑`)
    assert.deepEqual(pack.cards.map(card => card.code).sort(), [...CARD_PARTITIONS[id]].sort(), `${id} 卡号清单必须与分片一致`)
  }
  // 战役包登记全部 26 个遭遇组（camelCase），供 P7 逐章接线。
  const campaignPack = contentRegistry.getPack('tskCampaign')
  assert.equal(campaignPack.encounterGroupIds.length, ENCOUNTER_GROUPS.length)
  assert.deepEqual([...campaignPack.encounterGroupIds].sort(), [...ENCOUNTER_GROUPS].sort())
  assert.equal(contentRegistry.getPack('tskInvestigators').encounterGroupIds.length, 0)
  assert.equal(contentRegistry.getPack('tskPlayer').encounterGroupIds.length, 0)

  // 战役清单与十章占位**不进生产组合根**：大厅列表不出现，生产注册表也查不到。
  assert.equal(contentRegistry.getCampaign(CAMPAIGN_ID), null, 'P0 生产组合根不得注册战役')
  assert.equal(contentRegistry.listScenarios(CAMPAIGN_ID).length, 0, 'P0 生产组合根不得注册章节')
  assert.equal(campaignListForUi(contentRegistry).filter(campaign => campaign.id === CAMPAIGN_ID).length, 0,
    'P0 战役不得出现在大厅可启动列表')

  // 本地注册表复算：战役清单 + 十章占位可由注册表装配、身份正确，但不可启动。
  assertCampaignManifest(manifest)
  assert.equal(manifest.id, CAMPAIGN_ID)
  assert.equal(manifest.status, 'catalog-only')
  assert.deepEqual(manifest.scenarioIds, CHAPTER_IDS)
  assert.deepEqual(manifest.chaosBags, CHAOS_BAGS)
  const localRegistry = localTskRegistry()
  assert.equal(localRegistry.getCampaign(CAMPAIGN_ID).status, 'catalog-only')
  assert.equal(localRegistry.listScenarios(CAMPAIGN_ID).length, chapters.length)
  for (const chapter of chapters) {
    const scenario = localRegistry.getScenario(chapter.id)
    assert.equal(scenario.status, 'catalog-only')
    assert.equal(scenario.catalogReferenceOnly, true)
    assert.equal(scenario.referenceCode, chapter.referenceCode)
  }
  assert.throws(() => localRegistry.assertLaunchable(CAMPAIGN_ID), /catalog-only|不可启动|发布状态/, 'catalog-only 战役不得可启动')

  // P5 阶段口径：六位调查员 + 14 张专属依赖已开放（strict/可选人/不可构筑）；
  // 其余 TSK 记录（一般玩家卡 09021–09128、战役 09501+）仍 catalog-only。
  for (const code of INVESTIGATOR_CODES) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', `${code} 调查员应开放严格验收`)
    assert.equal(availability.strictAccepted, true, `${code} 应通过严格验收`)
    assert.equal(availability.selectable, true, `${code} 应进入选人池`)
    assert.equal(availability.deckbuilding, false, `${code} 调查员不可直接构筑`)
  }
  for (const code of SIGNATURE_CODES) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', `${code} 专属依赖应开放严格验收`)
    assert.equal(availability.dependencyOnly, true, `${code} 必须是依赖卡`)
    assert.equal(availability.deckbuilding, false, `${code} 不得进入一般构筑池`)
  }
  const p5Open = new Set([...INVESTIGATOR_CODES, ...SIGNATURE_CODES])
  for (const code of CYCLE_CODES.filter(code => !p5Open.has(code))) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'catalog-only', `${code} 不应开放可用性`)
    assert.equal(availability.strictAccepted, false, `${code} 不应通过严格验收`)
    assert.equal(availability.selectable, false, `${code} 不应进入选人池`)
    assert.equal(availability.deckbuilding, false, `${code} 不应进入一般构筑池`)
  }
  // 选人池只增加六位调查员（P5 声明），玩家卡与战役记录不进入选人/构筑。
  assert.equal(INVESTIGATOR_CODES.every(code => getAvailability(code).selectable === true), true)
  // 三包清单模块：调查员包 P5 起 playable（不可构筑）；战役包与玩家卡包仍 catalog-only。
  for (const packManifest of [campaignPackManifest, investigatorsPackManifest, playerPackManifest]) {
    const playable = packManifest.id === 'tskInvestigators'
    assert.equal(packManifest.status, playable ? 'playable' : 'catalog-only', `${packManifest.id} 阶段状态不正确`)
    assert.equal(packManifest.cards.some(card => card.deckbuilding === true), false)
    assert.equal(packManifest.cards.some(card => card.rulesImplemented === true), playable)
  }
})

test('P0 遭遇组分片：10 章专属 + 16 跨章共享，无交集且覆盖 26 组', () => {
  const chapterGroups = Object.values(CHAPTER_ENCOUNTER_GROUPS)
  assert.deepEqual(Object.keys(CHAPTER_ENCOUNTER_GROUPS).sort(), [...CHAPTER_IDS].sort())
  assert.equal(chapterGroups.length, 10)
  assert.equal(new Set(chapterGroups).size, chapterGroups.length, '同一遭遇组不能专属两个章节')
  assert.equal(SHARED_ENCOUNTER_GROUPS.length, 16)
  assert.deepEqual(chapterGroups.filter(group => SHARED_ENCOUNTER_GROUPS.includes(group)), [],
    '章专属组与跨章共享组不得重叠')
  assert.deepEqual([...chapterGroups, ...SHARED_ENCOUNTER_GROUPS].sort(), [...ENCOUNTER_GROUPS].sort(),
    '章专属 + 共享组必须无遗漏地覆盖 26 个遭遇组')
  for (const chapter of chapters) assert.ok(CHAPTER_ENCOUNTER_GROUPS[chapter.id], `章节 ${chapter.id} 没有归属遭遇组`)
  // 每个组都必须真的出现在战役包卡片的 camelCase encounterCode 上，且卡片不会引入组外 id。
  const campaignCards = CARD_PARTITIONS.tskCampaign.map(code => ALL_CARDS[code])
  const cardGroups = new Set(campaignCards.map(card => {
    const camel = card.encounterCode.replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())
    return camel[0].toLowerCase() + camel.slice(1)
  }))
  assert.deepEqual([...cardGroups].sort(), [...ENCOUNTER_GROUPS].sort(),
    '战役包卡片的遭遇组必须与 ENCOUNTER_GROUPS 完全一致')
  for (const group of ENCOUNTER_GROUPS) {
    assert.ok(campaignCards.some(card => {
      const camel = card.encounterCode.replace(/_([a-z])/g, (_, lower) => lower.toUpperCase())
      return camel[0].toLowerCase() + camel.slice(1) === group
    }), `遭遇组 ${group} 没有任何战役卡`)
  }
})

test('P0 配置：范围扫描脚本、基线脚本、校验命令与专项测试已登记', () => {
  const pkg = readJson(new URL('../package.json', import.meta.url))
  assert.equal(pkg.scripts['scan:tsk:scope'], 'node tools/scan-tsk-scope.mjs --write',
    '必须登记 scan:tsk:scope（生成/写入 scope 账本）')
  assert.equal(pkg.scripts['scan:tsk:scope:check'], 'node tools/scan-tsk-scope.mjs --check',
    '必须登记 scan:tsk:scope:check（只校验不重写）')
  assert.equal(pkg.scripts['scan:tsk:baseline'], 'node tools/scan-tsk-baseline.mjs --write',
    '必须登记 scan:tsk:baseline（生成/写入 P0 基线）')
  assert.equal(pkg.scripts['scan:tsk:baseline:check'], 'node tools/scan-tsk-baseline.mjs --check',
    '必须登记 scan:tsk:baseline:check（只校验不重写）')
  assert.equal(pkg.scripts['test:tsk'],
    'node --test tests/tsk-migration.test.mjs tests/tsk-primitives-state.test.mjs tests/tsk-primitives-concealed.test.mjs tests/tsk-primitives-keys-hollow.test.mjs tests/tsk-primitives-map.test.mjs tests/tsk-primitives-customizable.test.mjs tests/tsk-primitives-coterie-investigator.test.mjs tests/tsk-rules.test.mjs tests/tsk-interactions.test.mjs',
    '必须登记 test:tsk（P0 起先只跑迁移文件；P1 起扩为全部 TSK Node 专项）')
  // P1 机制扫描器与校验命令在 P1 落地。
  assert.equal(pkg.scripts['scan:tsk'], 'node tools/scan-tsk-mechanisms.mjs --write',
    '必须登记 scan:tsk（生成/写入机制扫描账本）')
  assert.equal(pkg.scripts['scan:tsk:check'], 'node tools/scan-tsk-mechanisms.mjs --check',
    '必须登记 scan:tsk:check（只校验不重写）')
  // P2 原语计划与验收证据命令在 P2 落地。
  assert.equal(pkg.scripts['plan:tsk:primitives'], 'node tools/audit-tsk-primitives.mjs --write',
    '必须登记 plan:tsk:primitives（生成/写入原语计划与只读目录）')
  assert.equal(pkg.scripts['audit:tsk:primitives'], 'node tools/audit-tsk-primitives.mjs --check',
    '必须登记 audit:tsk:primitives（只校验不重写）')
  assert.equal(pkg.scripts['verify:tsk:node'], 'node tools/verify-tsk.mjs --node',
    '必须登记 verify:tsk:node（P2 原语 Node 验收证据）')
})

// ── P1（规范第 1 步）：机制扫描、原语缺口与指南/密档/剧情来源 ─────────────────────────────

const REQUIRED_STORY_GROUPS = Object.freeze([
  'prologue', 'interlude1', 'embarkingAndTravel', 'theFoundationDossiers',
  'campaignMapDossiers', 'interludes', 'statusReports', 'specialRules', 'epilogue',
])
const CHINESE_STATUSES = Object.freeze(['present', 'present-needs-review', 'untranslated', 'missing'])

test('P1 机制扫描：439 条记录全部归类、六类机制与 8 项重点机制可复算，行为仍待实现', () => {
  const scan = buildScan()
  const failed = Object.entries(scan.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `机制扫描门禁失败：${failed.join(', ')}`)
  assert.equal(json(scan), readFileSync(new URL('../audit/tsk-mechanism-scan.json', import.meta.url), 'utf8'),
    '机制扫描账本必须由 buildScan() 逐字节复算（--check 口径）')

  // 439 条印刷记录全部至少归入一个机制；分类只用于扫描，绝不等于逐卡行为已实现。
  assert.equal(scan.cards.length, CYCLE_CODES.length)
  assert.deepEqual(scan.cards.map(card => card.code), [...CYCLE_CODES], '卡片顺序必须与 CYCLE_CODES 一致')
  assert.deepEqual(scan.unclassified, [], 'P1 不得留下未分类记录')
  for (const card of scan.cards) {
    assert.ok(card.mechanisms.length > 0, `${card.code} 没有归入任何机制`)
    assert.equal(card.behaviorStatus, 'pending', `${card.code} 在 P1 不能声称行为已实现`)
  }

  // 六类机制每类至少一条（规范 §4.2）。
  const types = new Set(scan.mechanisms.map(mechanism => mechanism.type))
  for (const type of MECHANISM_TYPES) assert.ok(types.has(type), `机制扫描缺少 ${type} 类型`)

  // README §5 的 8 项重点机制：代表卡、候选原语与「复用 / 扩展 / 缺口」结论都要登记。
  assert.equal(scan.keyMechanisms.length, 8)
  assert.deepEqual(scan.keyMechanisms.map(row => row.id), KEY_MECHANISMS.map(row => row.id))
  for (const key of scan.keyMechanisms) {
    assert.ok(key.cards.length > 0, `${key.id} 没有登记代表卡`)
    assert.ok(key.primitiveIds.length > 0, `${key.id} 没有登记候选原语`)
    assert.match(key.classification, /reuse|extend|gap/i,
      `${key.id} 的 classification 必须说明复用/扩展/缺口，当前 ${JSON.stringify(key.classification)}`)
    assert.deepEqual(key.unknownPrimitives, [], `${key.id} 引用了未登记原语`)
    const detail = key.classificationDetail
    assert.equal(detail.reuse.length + detail.extend.length + detail.new.length, key.primitiveIds.length)
  }
  // 八项重点机制里 7 项有真实缺口（P2 的输入）；「已有关键词」应保持纯复用，不因本循环重写。
  assert.equal(scan.keyMechanisms.filter(key => key.classificationDetail.new.length > 0).length, 7)
  assert.equal(scan.keyMechanisms.find(key => key.id === 'existingKeywords').classification, 'reuse')
  assert.deepEqual(scan.keyMechanisms.find(key => key.id === 'existingKeywords').classificationDetail.new, [])
  // 本循环新增机制在引擎里必须有明确「未支持」结论，而不是被当成已实现。
  for (const keyword of ['patrol', 'concealed', 'customizable', 'shift', 'hollow']) {
    assert.equal(ENGINE_INVENTORY.keywordSupport[keyword].supported, false, `${keyword} 不得被当作已支持`)
  }
  for (const keyword of ['hunter', 'aloof', 'retaliate', 'alert', 'surge', 'peril']) {
    assert.equal(ENGINE_INVENTORY.keywordSupport[keyword].supported, true, `${keyword} 应标为已支持`)
  }

  // 原语目录 77 项：引用到的原语必须全部可查；所有 new/extend 必须进入 primitiveGaps 且被机制引用。
  const catalogIds = Object.keys(PRIMITIVE_CATALOG)
  assert.equal(catalogIds.length, 77, `原语目录应为 77 项，实际 ${catalogIds.length}`)
  assert.deepEqual(scan.counts.primitiveCatalogByKind, { reuse: 28, extend: 10, new: 39 })
  const referenced = new Set()
  for (const mechanism of scan.mechanisms) for (const id of mechanism.candidatePrimitives) referenced.add(id)
  for (const key of scan.keyMechanisms) for (const id of key.primitiveIds) referenced.add(id)
  for (const id of referenced) assert.ok(catalogIds.includes(id), `机制引用的原语 ${id} 不在原语目录里`)
  const catalogGapIds = catalogIds.filter(id => ['new', 'extend'].includes(PRIMITIVE_CATALOG[id].kind)).sort()
  assert.deepEqual(scan.primitiveGaps.map(gap => gap.id), catalogGapIds, 'primitiveGaps 必须等于目录里的 new/extend 全集')
  for (const gap of scan.primitiveGaps) {
    assert.ok(['new', 'extend'].includes(gap.kind), `${gap.id} 的 kind 非法`)
    assert.ok(gap.mechanisms.length > 0, `原语缺口 ${gap.id} 没有被任何机制引用`)
  }
  assert.deepEqual([...BLOCKED_PRIMITIVES].sort(),
    ['new.concealedExposeRange', 'new.crossSeatActionWindow', 'new.hollowCountModifierScope'])
  for (const id of BLOCKED_PRIMITIVES) assert.ok(scan.primitiveGaps.some(gap => gap.id === id && gap.blocked === true))
  assert.ok(scan.pending.some(entry => entry.status === 'blocked' && entry.id === 'blockedPrimitives'))

  // 引擎盘点必须是真实读点：EFFECT_PRIMITIVES / ctx.api / kind / 窗口 / matcher / target / play channels。
  assert.ok(ENGINE_INVENTORY.effectPrimitives.count > 50, '效果原语清单异常')
  assert.ok(ENGINE_INVENTORY.apiModules.length >= 6)
  for (const module of ENGINE_INVENTORY.apiModules) assert.ok(module.topLevelCount > 0, `${module.module} 的 ctx.api 动词为空`)
  assert.ok(ENGINE_INVENTORY.windows.count > 100 && ENGINE_INVENTORY.matchers.count > 20)
  assert.ok(ENGINE_INVENTORY.abilityKinds.length > 0 && ENGINE_INVENTORY.targets.kinds.length > 0)
  assert.ok(ENGINE_INVENTORY.playChannels.channels.includes('attached')
    && ENGINE_INVENTORY.playChannels.channels.includes('deckTop'), '跨区域出牌通道清单异常')

  // scope 指纹：扫描必须钉在 P0 scope 上，scope 漂移后不得静默复用旧扫描。
  assert.equal(scan.scopeSha256, sha(json(buildScope())))
  // 模块确定性：同一来源两次构建逐字节一致（账本才能 --check 复算）。
  assert.equal(json(buildScan()), json(scan))
})

test('P1 指南与规则来源：十章指南分段、地图密档、17 幕间/8 状况报告/81 记录键中文覆盖可复算', () => {
  const scan = buildScan()
  const guides = scan.guides
  const rules = scan.rules

  // 十章指南：顺序、真实档案编号、段落层与中英文来源全部锁定。
  assert.equal(guides.length, 10)
  assert.deepEqual(guides.map(guide => guide.id), CHAPTER_IDS)
  for (const guide of guides) {
    assert.match(guide.sources.en.sha256, /^[0-9a-f]{64}$/, `${guide.id} 缺少英文指南来源`)
    assert.match(guide.sources.zh.sha256, /^[0-9a-f]{64}$/, `${guide.id} 缺少中文指南来源`)
    assert.ok(guide.sections.length > 0, `${guide.id} 没有指南段落`)
    assert.ok(guide.sections.some(section => section.layer === 'setup'), `${guide.id} 缺少 setup 层段落`)
    assert.ok(guide.sections.some(section => section.layer === 'resolutions'), `${guide.id} 缺少 resolutions 层段落`)
    assert.equal(guide.archiveLabelMatched, true, `${guide.id} 的档案编号 ${guide.archiveLabel} 未在来源中找到`)
    for (const section of guide.sections) {
      assert.match(section.sourceSha256, /^[0-9a-f]{64}$/, `${guide.id} 段落 ${section.path} 缺少来源 SHA-256`)
      assert.ok(TSK_GUIDE_LAYERS.includes(section.layer), `${guide.id} 段落 ${section.path} 的 layer 非法：${section.layer}`)
      assert.equal(section.status, 'pending', 'P1 只盘点覆盖，不冒充已完成指南')
      assert.ok(CHINESE_STATUSES.includes(section.chinese), `${guide.id} 段落 ${section.path} 的中文状态非法`)
      assert.equal(section.specialRule, section.path.startsWith('specialRules.'))
    }
    assert.equal(guide.summary.total, guide.sections.length)
    assert.equal(guide.summary.missing, guide.sections.filter(section => section.chinese === 'missing').length)
    assert.equal(guide.summary.untranslated, guide.sections.filter(section => section.chinese === 'untranslated').length)
  }
  // 指南层覆盖：规则、特别规则、版本化准备都要被真实盘点（不能只认 heading/setup）。
  const layers = new Set(guides.flatMap(guide => guide.sections.map(section => section.layer)))
  for (const layer of ['heading', 'tokens', 'setup', 'intro', 'resolutions', 'specialRules', 'rules']) {
    assert.ok(layers.has(layer), `指南缺少 ${layer} 层`)
  }

  // 战役地图密档：14 份档案 → 档案编号 → 地图节点 → 章节/海外幕间，全部可对账。
  assert.equal(rules.archiveLabels.dossierCount, 14)
  const dossiers = rules.mapDossiers
  assert.deepEqual(dossiers.map(dossier => dossier.label).sort(),
    ['11-B', '16-D', '21-F', '26-G', '28-I', '32-J', '33-K', '37-M', '38-N', '44-O', '49-R', '52-U', '53-V', '54-W'])
  const dossierByLabel = new Map(dossiers.map(dossier => [dossier.label, dossier]))
  assert.equal(dossierByLabel.get('11-B').chapterId, 'deadHeat')
  assert.equal(dossierByLabel.get('21-F').chapterId, 'dealingsInTheDark')
  assert.equal(dossierByLabel.get('26-G').interludeNumber, 26)
  assert.equal(dossierByLabel.get('44-O').interludeNumber, 44)
  assert.deepEqual(dossierByLabel.get('26-G').locations.sort(), ['Moscow', 'SanFrancisco'])
  assert.deepEqual(dossierByLabel.get('11-B').locations, ['Marrakesh'])
  for (const dossier of dossiers) {
    assert.ok(dossier.sections.length > 0, `密档 ${dossier.key} 没有段落`)
    assert.equal(dossier.sections.every(section => CHINESE_STATUSES.includes(section.chinese)), true)
    assert.ok(dossier.en, `密档 ${dossier.key} 缺少英文来源`)
    assert.ok(dossier.zh, `密档 ${dossier.key} 缺少中文来源`)
  }
  // 十章档案编号与密档/指南互相印证。
  assert.deepEqual(rules.archiveLabels.expected.chapters.map(entry => entry.label).sort(),
    ['11-B', '16-D', '21-F', '28-I', '33-K', '38-N', '46-Q', '5-A', '56-Y', '59-Z'])

  // 17 段幕间（1 + 14–55）：编号、名称、触发节点与档案编号。
  assert.equal(rules.interludes.length, 17)
  assert.deepEqual(rules.interludes.map(entry => entry.number),
    [1, 14, 20, 26, 27, 32, 36, 37, 44, 45, 49, 50, 51, 52, 53, 54, 55])
  for (const interlude of rules.interludes) {
    assert.ok(interlude.nameEn && interlude.nameZh, `幕间 ${interlude.number} 缺少中英文名`)
    assert.ok(interlude.sections.length > 0, `幕间 ${interlude.number} 没有段落`)
    assert.equal(interlude.status, 'pending')
  }
  assert.equal(rules.interludes.find(entry => entry.number === 14).archiveLabel, '14-C')
  assert.equal(rules.interludes.find(entry => entry.number === 55).archiveLabel, '55-X')

  // 8 份状况报告：固定阈值 6 + θ/ψ 动态 2。
  assert.equal(rules.statusReports.length, 8)
  const fixedReports = rules.statusReports.filter(entry => !entry.dynamic)
  assert.deepEqual(fixedReports.map(entry => [entry.report, entry.threshold]),
    [['alpha', 7], ['epsilon', 10], ['beta', 15], ['zeta', 20], ['gamma', 24], ['omega', 35]])
  assert.deepEqual(rules.statusReports.filter(entry => entry.dynamic).map(entry => entry.report), ['theta', 'psi'])
  assert.deepEqual(rules.statusReports.filter(entry => entry.dynamic).map(entry => entry.threshold), [null, null])

  // 记录键：参考 Key.hs 81 个构造子 × locale `key.*` 标签覆盖率（缺译必须显式登记，不静默）。
  assert.equal(rules.recordKeys.totals.keys, 81)
  assert.equal(rules.recordKeys.keys.length, 81)
  assert.match(rules.recordKeys.sha256, /^[0-9a-f]{64}$/)
  assert.match(rules.recordKeys.source, /Campaigns\/TheScarletKeys\/Key\.hs$/)
  assert.equal(rules.recordKeys.totals.withZhLabel + rules.recordKeys.totals.missingZhLabel, 81)
  const missingZhKeys = rules.recordKeys.keys.filter(entry => !entry.zh).map(entry => entry.zhLabelPath)
  assert.deepEqual(rules.recordKeys.keys.filter(entry => !entry.zh).map(entry => entry.zhLabelPath).length,
    rules.recordKeys.totals.missingZhLabel)
  if (missingZhKeys.length) {
    const pendingEntry = scan.pending.find(entry => entry.id === 'recordKeysMissingZh')
    assert.ok(pendingEntry, '记录键中文缺译必须登记进 pending')
    assert.deepEqual(pendingEntry.paths, missingZhKeys)
  }

  // 战役特别规则与剧情分组：prologue / interlude1 / 启程 / 基金会密档 / 地图密档 / 幕间 / 尾声齐全。
  assert.equal(rules.specialRules.entries, 6)
  assert.ok(rules.campaignStory.groups.length > 10)
  for (const group of REQUIRED_STORY_GROUPS) {
    assert.ok(rules.campaignStory.groups.some(entry => entry.id === group), `战役剧情缺少分组 ${group}`)
  }
  assert.ok(rules.campaignStory.groups.find(group => group.id === 'campaignMapDossiers').sections.length > 0)

  // 中文缺译必须被真实盘点（不能报「零缺口」应付）；按来源分组单列。
  assert.ok(scan.counts.chineseGaps.total > 0, '中文缺译未被盘点')
  assert.equal(scan.counts.chineseGaps.total,
    scan.counts.chineseGaps.guides + scan.counts.chineseGaps.story + scan.counts.chineseGaps.interludes
    + scan.counts.chineseGaps.statusReports + scan.counts.chineseGaps.specialRules)
  assert.ok(scan.counts.chineseGaps.guides > 0)
  // 模块确定性：两套 builder 都是纯数据。
  assert.equal(json(buildGuides()), json(guides))
  assert.equal(json(buildStoryScan()), json(rules))
})

// ── P2（规范第 2 步）：通用原语计划、只读目录与验收证据 ──────────────────────────────────

test('P2 原语计划：77 项目录全覆盖、49 项缺口全部 done、blocked 三项已裁决、证据可复算', async () => {
  const { buildPrimitivePlan } = await import('../tools/audit-tsk-primitives.mjs')
  const { plan, catalog } = await buildPrimitivePlan()
  const failed = Object.entries(plan.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `原语计划门禁失败：${failed.join(', ')}`)
  assert.equal(json(plan), readFileSync(new URL('../audit/tsk-primitive-plan.json', import.meta.url), 'utf8'),
    '原语计划必须由 buildPrimitivePlan() 逐字节复算（--check 口径）')
  assert.equal(json(catalog), readFileSync(new URL('../audit/tsk-primitive-catalog.json', import.meta.url), 'utf8'),
    '只读原语目录必须由 buildPrimitivePlan() 逐字节复算')
  assert.deepEqual(plan.counts, {
    catalog: 77, reuse: 31, p2: 46, p2New: 37, p2Extend: 9,
    gaps: 49, gapsDone: 49, reclassified: 3, escape: 0,
  })

  // P1 的 49 项原语缺口全部进入计划；每项都有模块/导出/测试/文档/API 且状态 done（或裁决为 reuse）。
  const gapIds = Object.keys(PRIMITIVE_CATALOG).filter(id => ['new', 'extend'].includes(PRIMITIVE_CATALOG[id].kind)).sort()
  assert.deepEqual(plan.gaps.map(row => row.id).sort(), gapIds)
  for (const row of plan.gaps) {
    assert.ok(['done', 'registered'].includes(row.status), `${row.id} 未完成：${row.status}`)
    assert.match(row.api, /^ctx\.api|^窗口|^view\.|^战役图|^外部修正源|^campaign\.|^既有/)
    for (const test of row.tests) assert.ok(plan.tests.includes(test), `${row.id} 的测试 ${test} 未进入证据`)
  }
  // 每项 P2 缺口至少被一个 P1 机制引用（不能凭空造原语）。
  assert.equal(plan.gaps.filter(row => row.mechanisms.length === 0).length, 0)

  // P1 标记 blocked 的三项：P2 已裁决且状态 done。
  assert.deepEqual(plan.adjudications.map(row => row.id).sort(), [...BLOCKED_PRIMITIVES].sort())
  for (const row of plan.adjudications) {
    assert.ok(row.adjudication.length > 10, `${row.id} 缺少裁决说明`)
    assert.equal(row.status, 'done')
  }
  // 最终分类与 P1 目录不同的三项必须给出理由（审计可见）。
  assert.equal(plan.reclassified.length, 3)
  for (const row of plan.reclassified) {
    assert.notEqual(row.catalogKind, row.classification)
    assert.ok(row.reason.length > 10)
  }
  // P2 不写单卡逻辑：escape 默认保持为空。
  assert.deepEqual(plan.escape, [])
  assert.ok(plan.escapeNote.length > 0)

  // 验收证据：tools/verify-tsk.mjs --node 生成，测试全过、replay 无漂移、测试文件哈希未过期。
  assert.equal(plan.evidence.present, true)
  assert.equal(plan.evidence.totals.fail, 0)
  assert.equal(plan.evidence.replay.compareExit, 0)
  assert.equal(plan.evidence.fresh, true)
  assert.ok(plan.tests.length >= 6, `P2 原语测试文件过少：${plan.tests.length}`)
  assert.equal(plan.gates.noEngineCardCodeBranches, true)

  // 只读目录：77 项、全部 done/registered、模块与导出可定位。
  assert.equal(Object.keys(catalog.entries).length, 77)
  for (const [id, entry] of Object.entries(catalog.entries)) {
    assert.ok(['done', 'registered'].includes(entry.status), `${id} 状态异常：${entry.status}`)
    assert.ok(entry.modules.length > 0, `${id} 没有模块定位`)
    assert.ok(entry.api.length > 0, `${id} 没有 API 读点说明`)
  }
  // 模块确定性：两次构建逐字节一致。
  const second = await buildPrimitivePlan()
  assert.equal(json(second.plan), json(plan))
})

