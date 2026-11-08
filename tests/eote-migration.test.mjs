// 七循环《地球边缘》（Edge of the Earth，EotE）P0 范围与基线回归。
//
// P0（M0）只锁定范围与身份，不做任何行为迁移：
//   · scope 账本（audit/eote-scope.json）必须由 tools/scan-eote-scope.mjs#buildScope() 逐字节复算，
//     基线（audit/eote-baseline.json）锁定起始提交与 golden replay 指纹，既有失败单独记账；
//   · 三个内容包按阶段开放：P5 调查员包 playable；战役与八章仍 catalog-only，大厅不出现、不可启动；
//   · 8 章专属遭遇组 + 16 个跨章共享组无交集地覆盖 24 组，三包分区 266/22/115 无重叠无遗漏。
//
// 后续里程碑（P1 机制扫描 → P8 发布）沿用同一文件追加断言，与 tests/tic-migration.test.mjs 同一模式。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildScope } from '../tools/scan-eote-scope.mjs'
import { buildScan } from '../tools/scan-eote-mechanisms.mjs'
import { buildGuides, buildRulesScan } from '../tools/eote-guide-scan.mjs'
import { REFERENCE, json, readJson, sha, sourceLock, MOD } from '../tools/eote-migration-lib.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  CAMPAIGN_ID, CARD_PARTITIONS, CHAOS_BAGS, CHAPTER_ENCOUNTER_GROUPS, CYCLE_CODES, DISCIPLINE_CODES, ENCOUNTER_GROUPS,
  INVESTIGATOR_CODES, SCENARIO_REFERENCE_CODES, SHARED_ENCOUNTER_GROUPS, chapters, toCamelCase,
} from '../content/campaigns/edgeOfTheEarth/shared.js'
import { PLAYER_CARD_CODES as EOTE_PLAYER_CARD_CODES, EOTE_PLAYER_BUILDABLE_CODES, EOTE_PLAYER_BASIC_WEAKNESS_CODES } from '../content/packs/eotePlayer/manifest.js'
import { CAMPAIGN_CARD_CODES as EOTE_CAMPAIGN_CARD_CODES } from '../content/packs/eoteCampaign/manifest.js'
import { manifest } from '../content/campaigns/edgeOfTheEarth/manifest.js'
import * as eoteScenario0 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/index.js'
import * as eoteScenario1 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/index.js'
import * as eoteScenario2 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/index.js'
import * as eoteScenario3 from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'
import * as eoteScenario4 from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import * as eoteScenario5 from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js'
import * as eoteScenario6 from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import * as eoteScenario7 from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
const eoteScenarios = [eoteScenario0, eoteScenario1, eoteScenario2, eoteScenario3, eoteScenario4, eoteScenario5, eoteScenario6, eoteScenario7]
import { campaignListForUi, createContentRegistry } from '../content/registry.js'
import { contentRegistry } from '../content/registered.js'
import { assertCampaignManifest, assertPackManifest } from '../content/schema.js'
import { getAvailability } from '../src/deck/availability.js'

const isFace = code => /[a-z]$/.test(code)
const CHAPTER_IDS = chapters.map(chapter => chapter.id)
const PACK_IDS = ['eoteCampaign', 'eoteInvestigators', 'eotePlayer']
const PACK_CARD_COUNTS = Object.freeze({ eoteCampaign: 266, eoteInvestigators: 22, eotePlayer: 115 })
// 平行卡/替代卡映射：EotE 印刷卡 → 参考资源里的平行版本（rop = Relics of the Past，iotv = Ire of the Void）。
const PARALLEL_PAIRS = Object.freeze([
  ['08007', '90062'], // 蒙特雷·杰克平行调查员
  ['08005', '98008'], // 诺曼专属卡替换：伊波恩之书 → 劈分时空之角
  ['08006', '98009'], // 诺曼专属弱点替换：预示者 → 复仇猎犬
  ['08008', '90063'], // 蒙特雷专属卡进阶：可靠的长鞭
  ['08009', '90064'], // 蒙特雷专属弱点进阶：被埋葬的秘密
])
const EXTERNAL_ENCOUNTER_SETS = Object.freeze(['AncientEvils', 'ChillingCold', 'LockedDoors', 'StrikingFear'])
// P1（第 1 步）扫描口径：六类机制、README §5 的 8 项重点机制、指南段落层与中文覆盖状态。
const MECHANISM_TYPES = Object.freeze(['primitive', 'keyword', 'rulebook', 'interaction', 'scenario', 'content'])
const KEY_MECHANISM_IDS = Object.freeze([
  'frost', 'partnersAndMemorials', 'tekeliliDeck', 'campShelterCheckpoints',
  'suppliesAndSeals', 'terrainGridAndHeight', 'multiclassStoryAssetsInvestigators', 'existingKeywords',
])
const GUIDE_LAYERS = Object.freeze([
  'heading', 'tokens', 'setup', 'intro', 'interlude', 'resolutions', 'specialRules', 'labels', 'deck', 'characters',
])
const CHINESE_STATUSES = Object.freeze(['present', 'present-needs-review', 'untranslated', 'missing'])
// 8 个章节单元 → 指南文件/篇章映射（README §4：拆分篇章共用 same 文件，按 partN.* 切片）。
const GUIDE_PART_ROWS = Object.freeze([
  ['iceAndDeathPart1', 'iceAndDeath', 'part1'],
  ['iceAndDeathPart2', 'iceAndDeath', 'part2'],
  ['iceAndDeathPart3', 'iceAndDeath', 'part3'],
  ['fatalMirage', 'fatalMirage', null],
  ['toTheForbiddenPeaks', 'toTheForbiddenPeaks', null],
  ['cityOfTheElderThings', 'cityOfTheElderThings', null],
  ['theHeartOfMadnessPart1', 'theHeartOfMadness', 'part1'],
  ['theHeartOfMadnessPart2', 'theHeartOfMadness', 'part2'],
])
// 三包分区键：扫描器沿用 CARD_PARTITIONS 的包键；兼容 campaign/investigators/player 这类角色键写法。
const PARTITION_KEYS = Object.freeze({
  eoteCampaign: ['eoteCampaign', 'campaign'],
  eoteInvestigators: ['eoteInvestigators', 'investigators'],
  eotePlayer: ['eotePlayer', 'player'],
})
function partitionCodes(scope, id) {
  for (const key of PARTITION_KEYS[id]) if (Array.isArray(scope.partitions?.[key])) return scope.partitions[key]
  return null
}
// 章节条目必须带真实提示/参考卡身份（印刷剧本身份卡类型是 scenario）。
// 字段名由扫描器决定（promptCard / referenceCard / …），这里按语义取：优先显式字段，其次深搜。
function promptCardOf(chapter) {
  for (const key of ['promptCard', 'referenceCard', 'reference']) {
    const value = chapter[key]
    if (value && typeof value === 'object' && typeof value.type === 'string') return value
  }
  const found = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.type === 'scenario') found.push(value)
    for (const [key, child] of Object.entries(value)) {
      if (key === 'guideSources' || key === 'chaosReference') continue
      visit(child)
    }
  }
  visit(chapter)
  return found[0] || null
}
// 跨循环依赖条目的集合名字段：扫描器可写 set / group / id / name，口径不同但语义唯一。
function dependencyName(entry) {
  return String(entry.set ?? entry.group ?? entry.id ?? entry.name ?? '')
}
// P0 生产组合根只登记三个 catalog-only 内容包：战役清单与八章占位**刻意不注册**，
// 避免未开放内容进入大厅/音乐/指南流程（与 TIC 迁移路径一致）。战役/章节身份用本地注册表
// 复算，口径同 tests/tic-migration.test.mjs#productionInputRegistry。
function localEoteRegistry() {
  return createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [manifest],
    scenarios: eoteScenarios,
  })
}

test('P0 范围账本：403 条记录三包守恒、来源锁定、八章身份与混乱袋可复算', () => {
  const scope = buildScope()
  assert.ok(Object.values(scope.gates).every(value => value === true), `范围门禁失败：${json(scope.gates)}`)
  assert.equal(json(scope), readFileSync(new URL('../audit/eote-scope.json', import.meta.url), 'utf8'),
    'scope 账本必须由 buildScope() 逐字节复算（--check 口径）')

  // 计数：367 主卡 + 36 关联面 = 403 条印刷记录；三包 266/22/115。
  assert.deepEqual(scope.counts.packs, PACK_CARD_COUNTS)
  assert.equal(scope.counts.records, 403)
  assert.equal(scope.counts.main, 367)
  assert.equal(scope.counts.faces, 36)
  assert.equal(scope.counts.records, scope.counts.main + scope.counts.faces, '主卡 + 关联面必须等于记录总数')
  assert.equal(scope.counts.chapters, 8)
  assert.equal(scope.counts.encounterGroups, 24)
  assert.equal(scope.counts.sharedGroups, 16)
  assert.equal(scope.counts.chapterGroups, 8)
  assert.equal(scope.counts.investigators, INVESTIGATOR_CODES.length)
  assert.equal(scope.counts.signatures, 9)
  assert.equal(scope.counts.disciplines, 8)
  assert.equal(scope.counts.referenceCards, SCENARIO_REFERENCE_CODES.length)

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

  // 关联面（a/b）必须真的进入分区：战役 28 张 + 陈丽丽演武 8 张。
  // 注意：eoep 的关联面全部是演武（08011a–08014b），按 shared.js 归属调查员包；
  // 一般玩家卡分区当前没有 a/b 面，因此“玩家侧”按 调查员 + 一般玩家卡 两个分区合并核对。
  const faces = [...CYCLE_CODES].filter(isFace)
  assert.equal(faces.length, 36)
  for (const code of faces) assert.ok(flat.includes(code), `关联面 ${code} 未进入任何分区`)
  const playerSide = [...partitionCodes(scope, 'eoteInvestigators'), ...partitionCodes(scope, 'eotePlayer')]
  assert.ok(playerSide.some(isFace), '玩家侧分区必须包含关联面（陈丽丽演武 08011a–08014b）')
  assert.ok(partitionCodes(scope, 'eoteCampaign').some(isFace), '战役分区必须包含关联面（08556b–08583b）')

  // 来源逐文件锁定：SHA-256 64 位十六进制且字节数非零（漂移后 --check 必须失败）。
  assert.ok(scope.sources.length > 0)
  for (const lock of scope.sources) {
    assert.match(lock.sha256, /^[0-9a-f]{64}$/, `${lock.path} 的 SHA-256 非法`)
    assert.ok(lock.bytes > 0, `${lock.path} 字节数为 0`)
  }

  // 重印：canonical 必须在本组内，组内卡号都在卡池里，每条记录的 canonicalCode 与本组一致。
  const cardByCode = new Map(scope.cards.map(card => [card.code, card]))
  for (const group of scope.reprintGroups) {
    assert.ok(group.codes.includes(group.canonicalCode), `重印组 ${group.canonicalCode} 缺少 canonical 自身`)
    assert.ok(group.codes.every(code => ALL_CARDS[code]), '重印组包含卡池之外的卡号')
    for (const code of group.codes) {
      const card = cardByCode.get(code)
      if (card) assert.equal(card.canonicalCode, group.canonicalCode, `${code} 的 canonicalCode 与重印组不一致`)
    }
  }

  // 平行卡/替代卡映射：调查员平行版本与专属卡替换必须登记，方向 = EotE 印刷卡 → 平行卡。
  for (const [baseCode, alternateCode] of PARALLEL_PAIRS) {
    assert.ok(scope.parallelAlternates.some(entry => entry.baseCode === baseCode && entry.alternateCode === alternateCode),
      `缺少平行卡映射 baseCode ${baseCode} ↔ alternateCode ${alternateCode}`)
  }

  // 八章身份：顺序、stepId、真实提示卡与中英指南来源（带 SHA-256）都必须锁定。
  assert.equal(scope.chapters.length, chapters.length)
  assert.deepEqual(scope.chapters.map(chapter => chapter.id), CHAPTER_IDS, '八章顺序必须与 shared.js 一致')
  assert.deepEqual(scope.chapters.map(chapter => chapter.stepId),
    ['08501a', '08501b', '08501c', '08549', '08596', '08621', '08648a', '08648b'])
  assert.deepEqual([...SCENARIO_REFERENCE_CODES].sort(), [...new Set(chapters.map(chapter => chapter.referenceCode))].sort())
  for (const [index, chapter] of scope.chapters.entries()) {
    const printed = chapters[index]
    assert.equal(chapter.referenceCode, printed.referenceCode, `${chapter.id} 的提示卡号不对`)
    assert.equal(chapter.guideSources.length, 2, `${chapter.id} 必须锁定中英两份指南来源`)
    for (const source of chapter.guideSources) {
      assert.match(source.sha256, /^[0-9a-f]{64}$/, `${chapter.id} 指南来源缺少 SHA-256`)
    }
    const guideText = chapter.guideSources.map(source => JSON.stringify(source))
    assert.ok(guideText.some(text => text.includes('locales/en')), `${chapter.id} 缺少英文指南来源`)
    assert.ok(guideText.some(text => text.includes('locales/zh')), `${chapter.id} 缺少中文指南来源`)
    // 提示/参考卡必须是真实剧本卡（type === 'scenario'），拆分篇章共用同一张印刷提示卡。
    const prompt = promptCardOf(chapter)
    assert.ok(prompt, `${chapter.id} 缺少提示/参考卡身份`)
    assert.equal(prompt.type, 'scenario', `${chapter.id} 的提示卡不是剧本卡`)
    if (prompt.code) {
      assert.ok([printed.code, printed.stepId, printed.referenceCode].includes(prompt.code),
        `${chapter.id} 的提示卡号 ${prompt.code} 不是该章的印刷/步骤卡号`)
    }
  }

  // 跨循环依赖：核心遭遇组只登记依赖，不重复归入本循环；每个依赖都要有卡号与使用章节。
  for (const name of EXTERNAL_ENCOUNTER_SETS) {
    const dependency = scope.externalDependencies.find(entry => dependencyName(entry) === name)
    assert.ok(dependency, `缺少跨循环依赖 ${name}`)
    assert.ok(dependency.codes.length > 0, `${name} 没有登记可复用的卡号`)
    assert.ok(dependency.usedBy.length > 0, `${name} 没有登记使用章节`)
    for (const chapterId of dependency.usedBy) {
      assert.ok(CHAPTER_IDS.includes(chapterId), `${name} 的 usedBy 含未知章节 ${chapterId}`)
    }
  }

  // 基线指针：scope 必须携带起始提交与 replay 文件位置，供 P0 复现。
  assert.ok(scope.baseline && typeof scope.baseline === 'object')
  assert.match(scope.baseline.gitHead, /^[0-9a-f]{40}$/)
  assert.equal(typeof scope.baseline.replayFile, 'string')
  assert.ok(scope.baseline.replayFile.length > 0)

  // 混乱袋四档：寒霜标记 0/1/2/3，核心符号齐全，且没有祝福/诅咒/古神符号。
  assert.deepEqual(scope.chaosBags, CHAOS_BAGS, 'scope 混乱袋必须与 shared.js 一致')
  const frostCount = tier => CHAOS_BAGS[tier].filter(token => token === 'frost').length
  assert.equal(frostCount('easy'), 0, '易难度不得有 [frost]')
  assert.equal(frostCount('standard'), 1)
  assert.equal(frostCount('hard'), 2)
  assert.equal(frostCount('expert'), 3)
  for (const tier of ['easy', 'standard', 'hard', 'expert']) {
    for (const token of ['skull', 'cultist', 'tablet', 'autofail', 'eldersign']) {
      assert.ok(CHAOS_BAGS[tier].includes(token), `${tier} 混乱袋缺少 ${token}`)
    }
    for (const token of ['bless', 'curse', 'elderthing']) {
      assert.equal(CHAOS_BAGS[tier].includes(token), false, `${tier} 混乱袋不应包含 ${token}`)
    }
  }
})

test('P0 原始基线：起始提交、既有失败与 golden replay 指纹可复算', () => {
  const baseline = readJson(new URL('../audit/eote-baseline.json', import.meta.url))
  assert.match(baseline.gitHead, /^[0-9a-f]{40}$/, '基线必须记录 40 位起始提交')
  assert.equal(typeof baseline.replayFile, 'string')
  // replay 指纹按 recorded 时的文件字节复算：文件漂移即失败，不允许手写“已知哈希”。
  const replay = sourceLock(baseline.replayFile, MOD)
  assert.equal(replay.sha256, baseline.replaySha256, 'replay 基线文件已漂移或被手工改写')
  assert.ok(replay.bytes > 0)
  assert.ok(Array.isArray(baseline.fastFailures), 'fastFailures 必须是数组')
  assert.ok(baseline.fastFailures.length > 0, 'P0 必须如实记录基线时已有的失败，不能漏记')
})

test('P0 目录注册：P5 调查员包开放，战役/一般玩家卡包仍 catalog-only，全卡不可构筑', () => {
  // 三个内容包：P0 只登记身份；P5 起 eoteInvestigators 按真实清单升 playable，
  // 战役包与一般玩家卡包仍 catalog-only（P7/P6 才开放）。
  const packPhases = { eoteCampaign: 'playable', eoteInvestigators: 'playable', eotePlayer: 'playable' }
  for (const id of PACK_IDS) {
    const pack = contentRegistry.getPack(id)
    assert.ok(pack, `${id} 应已注册进组合根`)
    assertPackManifest(pack)
    assert.equal(pack.status, packPhases[id], `${id} 的开放阶段不对`)
    assert.equal(pack.cards.length, PACK_CARD_COUNTS[id], `${id} 卡数必须与 scope 分片一致`)
    if (pack.status === 'catalog-only') {
      assert.ok(pack.cards.every(card => card.cataloged === true && card.rulesImplemented === false && card.deckbuilding === false),
        `${id} 收录不能冒充规则已实现或可构筑`)
    } else if (id === 'eoteCampaign') {
      // P7：战役包 playable——266 条记录全部登记规则已实现，且不作构筑卡。
      assert.ok(pack.cards.every(card => card.cataloged === true && card.rulesImplemented === true && card.deckbuilding === false),
        `${id} P7 开放包必须逐卡登记规则已实现且不可构筑`)
      assert.equal(pack.encounterGroupIds.length, ENCOUNTER_GROUPS.length)
    } else if (id === 'eotePlayer') {
      // P6：一般玩家卡包 playable——115 张全部登记规则已实现；可构筑码与基础弱点依赖必须与账本一致。
      assert.ok(pack.cards.every(card => card.cataloged === true && card.rulesImplemented === true),
        `${id} P6 开放包必须逐卡登记规则已实现`)
      for (const card of pack.cards) {
        assert.equal(card.deckbuilding, EOTE_PLAYER_BUILDABLE_CODES.includes(card.code), `${card.code} 可构筑旗标与生成码表不一致`)
        assert.equal(card.dependencyOnly === true, EOTE_PLAYER_BASIC_WEAKNESS_CODES.includes(card.code), `${card.code} 基础弱点依赖旗标与生成码表不一致`)
      }
      assert.equal(pack.cards.length, EOTE_PLAYER_CARD_CODES.length, '玩家卡包卡数必须与生成码表一致')
    } else {
      assert.ok(pack.cards.every(card => card.cataloged === true && card.rulesImplemented === true && card.deckbuilding === false),
        `${id} P5 开放包必须逐卡登记规则已实现且仍不可作为一般构筑卡`)
      assert.ok(pack.cards.every(card => card.investigator === true || card.dependencyOnly === true),
        `${id} P5 开放包只含调查员与专属依赖`)
    }
  }
  // 战役包登记全部 24 个遭遇组（camelCase），供后续逐章接线。
  const campaignPack = contentRegistry.getPack('eoteCampaign')
  assert.equal(campaignPack.encounterGroupIds.length, ENCOUNTER_GROUPS.length)
  assert.deepEqual([...campaignPack.encounterGroupIds].sort(), [...ENCOUNTER_GROUPS].sort())

  // P7：生产组合根注册战役与八章，大厅可启动。
  const productionCampaign = contentRegistry.getCampaign(CAMPAIGN_ID)
  assert.ok(productionCampaign, 'P7 生产组合根必须注册战役')
  assert.equal(productionCampaign.status, 'playable')
  assert.equal(contentRegistry.listScenarios(CAMPAIGN_ID).length, chapters.length, 'P7 生产组合根必须注册八章')
  assert.ok(campaignListForUi(contentRegistry).some(campaign => campaign.id === CAMPAIGN_ID),
    'P7 战役必须出现在大厅可启动列表')

  // 战役清单：八章顺序、记录 schema、flow 与故事来源。
  assertCampaignManifest(manifest)
  assert.equal(manifest.status, 'playable')
  assert.deepEqual(manifest.scenarioIds, CHAPTER_IDS)
  assert.deepEqual(manifest.requiredPackIds.slice().sort(), ['core', 'eoteCampaign', 'eoteInvestigators', 'eotePlayer'].sort())
  assert.ok(Object.keys(manifest.recordSchema).length >= 56 + 8, 'P7 必须登记 Key.hs 记录与流程层记录')
  assert.ok(manifest.flow && manifest.flow.start === 'prologue', 'P7 必须提供序幕起的战役 flow')

  // 本地注册表复算：八章可装配、身份正确、整体可启动。
  const localRegistry = localEoteRegistry()
  assert.equal(localRegistry.listScenarios(CAMPAIGN_ID).length, chapters.length)
  assert.equal(campaignListForUi(localRegistry).filter(campaign => campaign.id === CAMPAIGN_ID).length, 1,
    'P7 战役必须进入大厅列表')
  localRegistry.assertLaunchable(CAMPAIGN_ID)
  for (const chapter of chapters) {
    const scenario = localRegistry.getScenario(chapter.id)
    assert.equal(scenario.status, 'playable')
  }

  // 全 403 条记录：P5 只开放调查员包（5 选人 + 17 专属依赖），其余仍目录收录。
  const P5_SELECTABLE = ['08001', '08004', '08007', '08010', '08016']
  const P5_DEPENDENCIES = [...P5_SELECTABLE.flatMap(code => ALL_CARDS[code].deckRequirements.signatureCards),
    ...DISCIPLINE_CODES]
  for (const code of CYCLE_CODES) {
    const availability = getAvailability(code)
    if (EOTE_PLAYER_BUILDABLE_CODES.includes(code)) {
      assert.equal(availability.deckbuilding, true, `${code} P6 起应可进入一般构筑池`)
      assert.equal(availability.selectable, false, `${code} 不是调查员，不应进入选人池`)
      assert.equal(availability.dependencyOnly, false, `${code} 可构筑玩家卡不应标记为依赖`)
      assert.equal(availability.availability, 'strict', `${code} P6 验收后应为 strict`)
      continue
    }
    if (EOTE_PLAYER_BASIC_WEAKNESS_CODES.includes(code)) {
      assert.equal(availability.deckbuilding, false, `${code} 基础弱点不应进入一般构筑池`)
      assert.equal(availability.dependencyOnly, true, `${code} 基础弱点只作构筑依赖`)
      assert.equal(availability.availability, 'strict', `${code} P6 验收后应为 strict`)
      continue
    }
    if (EOTE_CAMPAIGN_CARD_CODES.includes(code)) {
      assert.equal(availability.availability, 'strict', `${code} P7 战役卡应为 strict`)
      assert.equal(availability.deckbuilding, false, `${code} 战役卡不应进入一般构筑池`)
      assert.equal(availability.selectable, false, `${code} 战役卡不应进入选人池`)
      assert.equal(availability.dependencyOnly, false, `${code} 战役卡不是构筑依赖`)
      continue
    }
    assert.equal(availability.deckbuilding, false, `${code} 不应进入一般构筑池`)
    if (P5_SELECTABLE.includes(code)) {
      assert.equal(availability.selectable, true, `${code} P5 起应可在调查员包内选人`)
      assert.equal(availability.availability, 'strict', `${code} P5 验收后应为 strict`)
      continue
    }
    if (P5_DEPENDENCIES.includes(code)) {
      assert.equal(availability.selectable, false, `${code} 专属依赖不应进入选人池`)
      assert.equal(availability.dependencyOnly, true, `${code} 专属依赖只作构筑依赖`)
      assert.equal(availability.availability, 'strict', `${code} P5 验收后应为 strict`)
      continue
    }
    assert.equal(availability.availability, 'catalog-only', `${code} 不应开放可用性`)
    assert.equal(availability.strictAccepted, false, `${code} 不应通过严格验收`)
    assert.equal(availability.selectable, false, `${code} 不应进入选人池`)
  }
})

test('P0 遭遇组分片：8 章专属 + 16 跨章共享，无交集且覆盖 24 组', () => {
  const chapterGroups = Object.values(CHAPTER_ENCOUNTER_GROUPS)
  // 章 key 与八章单元一一对应。
  assert.deepEqual(Object.keys(CHAPTER_ENCOUNTER_GROUPS).sort(), [...CHAPTER_IDS].sort())
  assert.equal(chapterGroups.length, 8)
  assert.equal(new Set(chapterGroups).size, chapterGroups.length, '同一遭遇组不能专属两个章节')
  assert.equal(SHARED_ENCOUNTER_GROUPS.length, 16)
  // 两部分互不重叠，并集恰好是全部 24 组。
  assert.deepEqual(chapterGroups.filter(group => SHARED_ENCOUNTER_GROUPS.includes(group)), [],
    '章专属组与跨章共享组不得重叠')
  assert.deepEqual([...chapterGroups, ...SHARED_ENCOUNTER_GROUPS].sort(), [...ENCOUNTER_GROUPS].sort(),
    '章专属 + 共享组必须无遗漏地覆盖 24 个遭遇组')
  for (const chapter of chapters) {
    assert.ok(CHAPTER_ENCOUNTER_GROUPS[chapter.id], `章节 ${chapter.id} 没有归属遭遇组`)
  }
  // 每个组都必须真的出现在战役包卡片的 camelCase encounterCode 上，且卡片不会引入组外 id。
  const campaignCards = CARD_PARTITIONS.eoteCampaign.map(code => ALL_CARDS[code])
  const cardGroups = new Set(campaignCards.map(card => toCamelCase(card.encounterCode)))
  assert.deepEqual([...cardGroups].sort(), [...ENCOUNTER_GROUPS].sort(),
    '战役包卡片的遭遇组必须与 ENCOUNTER_GROUPS 完全一致')
  for (const group of ENCOUNTER_GROUPS) {
    assert.ok(campaignCards.some(card => toCamelCase(card.encounterCode) === group), `遭遇组 ${group} 没有任何战役卡`)
  }
})

test('P0 配置：范围扫描脚本、校验命令与专项测试已登记', () => {
  const pkg = readJson(new URL('../package.json', import.meta.url))
  assert.equal(pkg.scripts['scan:eote:scope'], 'node tools/scan-eote-scope.mjs --write',
    '必须登记 scan:eote:scope（生成/写入 scope 账本）')
  assert.equal(pkg.scripts['scan:eote:scope:check'], 'node tools/scan-eote-scope.mjs --check',
    '必须登记 scan:eote:scope:check（只校验不重写）')
  // P0 起 test:eote 先只跑本文件；P2 起扩为全部 eote Node 专项（本文件 + 六个原语组 + P3 规则书 + P4 交互）。
  assert.equal(pkg.scripts['test:eote'],
    'node --test tests/eote-migration.test.mjs tests/eote-primitives-frost.test.mjs tests/eote-primitives-campaign.test.mjs tests/eote-primitives-flow.test.mjs tests/eote-primitives-geo.test.mjs tests/eote-primitives-travel.test.mjs tests/eote-primitives-investigator.test.mjs tests/eote-rules.test.mjs tests/eote-interactions.test.mjs tests/eote-investigator-daniela.test.mjs tests/eote-investigator-norman.test.mjs tests/eote-investigator-lily.test.mjs tests/eote-investigator-monterey.test.mjs tests/eote-investigator-bob.test.mjs tests/eote-player-m2-1.test.mjs tests/eote-player-m2-2.test.mjs tests/eote-player-m2-3.test.mjs tests/eote-player-m2-4.test.mjs tests/eote-scenario-iceAndDeathPart1.test.mjs tests/eote-scenario-iceAndDeathPart2.test.mjs tests/eote-scenario-iceAndDeathPart3.test.mjs tests/eote-scenario-fatalMirage.test.mjs tests/eote-scenario-toTheForbiddenPeaks.test.mjs tests/eote-scenario-cityOfTheElderThings.test.mjs tests/eote-scenario-theHeartOfMadnessPart1.test.mjs tests/eote-scenario-theHeartOfMadnessPart2.test.mjs tests/eote-scenario-shared.test.mjs tests/eote-campaign-flow.test.mjs tests/eote-story.test.mjs tests/eote-all-cards.test.mjs tests/eote-p8-registration.test.mjs tests/eote-p8-campaign.test.mjs tests/eote-p8-multiplayer.test.mjs tests/replay-eote-p8.test.mjs tests/eote-migration-ledger.test.mjs',
    '必须登记 test:eote（run 本文件与全部原语/规则书/交互/调查员组测试）')
})

// P1 扫描器结构适配：原语目录/缺口清单允许「数组」或「id → 定义」映射两种写法
//（TIC/TDE 账本用映射，本循环扫描器可能用数组；两种都不影响断言语义）。
function primitiveEntriesOf(scan) {
  if (Array.isArray(scan.primitives)) return scan.primitives
  return Object.entries(scan.primitives || {}).map(([id, value]) => ({
    id, ...(value && typeof value === 'object' ? value : {}),
  }))
}
function primitiveGapIdsOf(scan) {
  return new Set((scan.primitiveGaps || []).map(entry => String(entry?.id ?? entry?.primitive ?? entry)))
}
function mechanismPrimitiveIdsOf(mechanism) {
  return [...(mechanism.primitiveIds || []), ...(mechanism.candidatePrimitives || [])].map(String)
}
function keyMechanismPrimitiveIdsOf(key) {
  return (key.primitiveIds || key.candidatePrimitives || []).map(String)
}
// 重点机制的 classification：允许显式字符串，或由 existing 布尔推导（true = 现有能力可复用）。
function keyMechanismClassificationOf(key) {
  if (typeof key.classification === 'string') return key.classification
  if (typeof key.existing === 'boolean') return key.existing ? 'reuse' : 'gaps'
  return ''
}

test('P1 机制扫描：403 条记录全部归类、六类机制与 8 项重点机制可复算，行为仍待实现', () => {
  const scan = buildScan()
  assert.ok(Object.values(scan.gates).every(value => value === true), `机制扫描门禁失败：${json(scan.gates)}`)
  assert.equal(json(scan), readFileSync(new URL('../audit/eote-mechanism-scan.json', import.meta.url), 'utf8'),
    '机制扫描账本必须由 buildScan() 逐字节复算（--check 口径）')

  // 403 条印刷记录全部至少归入一个机制；分类只用于扫描，绝不等于逐卡行为已实现。
  assert.equal(scan.cards.length, CYCLE_CODES.length)
  assert.deepEqual(scan.cards.map(card => card.code), [...CYCLE_CODES], '卡片顺序必须与 CYCLE_CODES 一致')
  assert.deepEqual(scan.unclassified, [], 'P1 不得留下未分类记录')
  for (const card of scan.cards) {
    assert.ok(card.mechanisms.length > 0, `${card.code} 没有归入任何机制`)
    assert.equal(card.behaviorStatus, 'pending', `${card.code} 在 P1 不能声称行为已实现`)
  }

  // 六类机制每类至少一条（规范 §4.2：type 至少覆盖 primitive/keyword/rulebook/interaction/scenario/content）。
  const types = new Set(scan.mechanisms.map(mechanism => mechanism.type))
  for (const type of MECHANISM_TYPES) assert.ok(types.has(type), `机制扫描缺少 ${type} 类型`)

  // README §5 的 8 项重点机制：代表卡、候选原语与「复用 / 缺口」结论都要登记。
  assert.equal(scan.keyMechanisms.length, KEY_MECHANISM_IDS.length)
  for (const id of KEY_MECHANISM_IDS) {
    const key = scan.keyMechanisms.find(entry => entry.id === id)
    assert.ok(key, `缺少重点机制 ${id}`)
    assert.ok(key.cards.length > 0, `${id} 没有登记代表卡`)
    assert.ok(keyMechanismPrimitiveIdsOf(key).length > 0, `${id} 没有登记候选原语`)
    const classification = keyMechanismClassificationOf(key)
    assert.ok(/reuse|gap/i.test(classification),
      `${id} 的 classification 必须说明复用（reuse）或缺口（gaps），当前 ${JSON.stringify(classification)}`)
  }

  // 原语目录（60 项）：机制引用到的候选原语必须全部可查；新增/扩展原语必须在缺口清单排队。
  const primitiveEntries = primitiveEntriesOf(scan)
  const primitiveIds = new Set(primitiveEntries.map(entry => String(entry.id)))
  assert.equal(primitiveIds.size, 60, `原语目录应为 60 项，实际 ${primitiveIds.size}`)
  const referenced = new Set()
  for (const mechanism of scan.mechanisms) for (const id of mechanismPrimitiveIdsOf(mechanism)) referenced.add(id)
  for (const key of scan.keyMechanisms) for (const id of keyMechanismPrimitiveIdsOf(key)) referenced.add(id)
  for (const id of referenced) assert.ok(primitiveIds.has(id), `机制引用的原语 ${id} 不在原语目录里`)
  const primitiveGapIds = primitiveGapIdsOf(scan)
  for (const entry of primitiveEntries) {
    // 目录条目的「新增/扩展」标记口径：kind（P1-B 目录）或 new/classification/status 布尔别名。
    const isNewOrExtend = entry.new === true || ['new', 'extend'].includes(entry.kind)
      || ['new', 'extend'].includes(entry.classification) || ['new', 'extend'].includes(entry.status)
    if (isNewOrExtend) assert.ok(primitiveGapIds.has(String(entry.id)), `新增/扩展原语 ${entry.id} 未进入 primitiveGaps`)
  }

  // scope 指纹：机制扫描必须钉在 P0 scope 上，scope 漂移后不得静默复用旧扫描。
  assert.equal(scan.scopeSha256, sha(json(buildScope())), '机制扫描的 scopeSha256 必须与当前 scope 账本一致')
  // 指南/规则扫描经 guide 模块嵌入，扫描器不得私写另一套。
  assert.deepEqual(scan.guides, buildGuides())
  assert.deepEqual(scan.rules, buildRulesScan())
})

test('P1 指南与规则来源：8 章指南分段、战役剧情/记录键/伙伴/物资中文覆盖可复算', () => {
  const guides = buildGuides()
  const rules = buildRulesScan()
  assert.equal(guides.length, GUIDE_PART_ROWS.length)
  assert.deepEqual(guides.map(guide => guide.id), CHAPTER_IDS)
  const byId = new Map(guides.map(guide => [guide.id, guide]))
  for (const [id, guideId, part] of GUIDE_PART_ROWS) {
    const guide = byId.get(id)
    assert.ok(guide, `缺少指南行 ${id}`)
    assert.equal(guide.guideId, guideId, `${id} 的指南文件不对`)
    assert.equal(guide.part, part, `${id} 的篇章映射不对`)
    assert.equal(guide.partMapping, part ?? 'whole-file')
    for (const lang of ['en', 'zh']) {
      assert.match(guide.sources[lang].sha256, /^[0-9a-f]{64}$/, `${id} 的 ${lang} 指南来源缺少 SHA-256`)
    }
    assert.ok(guide.sections.length > 0, `${id} 没有指南段落`)
    assert.ok(guide.sections.some(section => section.layer === 'setup'), `${id} 缺少 setup 层段落`)
    assert.ok(guide.sections.some(section => section.layer === 'resolutions'), `${id} 缺少 resolutions 层段落`)
    for (const section of guide.sections) {
      assert.match(section.sourceSha256, /^[0-9a-f]{64}$/, `${id} 段落 ${section.path} 缺少来源 SHA-256`)
      assert.ok(GUIDE_LAYERS.includes(section.layer), `${id} 段落 ${section.path} 的 layer 非法：${section.layer}`)
      assert.equal(section.status, 'pending', 'P1 只盘点覆盖，不冒充已完成指南')
      assert.ok(CHINESE_STATUSES.includes(section.chinese), `${id} 段落 ${section.path} 的中文状态非法：${section.chinese}`)
      assert.equal(section.specialRule, section.path.startsWith('specialRules.'))
    }
    assert.equal(guide.summary.total, guide.sections.length)
    assert.equal(guide.summary.missing, guide.sections.filter(section => section.chinese === 'missing').length)
    assert.equal(guide.summary.untranslated, guide.sections.filter(section => section.chinese === 'untranslated').length)
    assert.equal(guide.summary.specialRules, guide.sections.filter(section => section.specialRule).length)
  }
  // 拆篇映射：冰原 I–III 共用 iceAndDeath，疯狂之心 I–II 共用 theHeartOfMadness。
  assert.deepEqual(guides.filter(guide => guide.guideId === 'iceAndDeath').map(guide => guide.part), ['part1', 'part2', 'part3'])
  assert.deepEqual(guides.filter(guide => guide.guideId === 'theHeartOfMadness').map(guide => guide.part), ['part1', 'part2'])
  // 特别规则与中文缺口必须被真实盘点到（不能报「零缺口」应付）。
  assert.ok(guides.some(guide => guide.sections.some(section => section.specialRule)), '指南特别规则未盘点')
  const chineseStatuses = new Set(guides.flatMap(guide => guide.sections.map(section => section.chinese)))
  assert.ok(chineseStatuses.has('missing'), '中文缺失段落未被盘点')
  assert.ok(chineseStatuses.has('untranslated'), '中文未翻译段落未被盘点')

  // 战役剧情/规则：序幕、三个检查点、三段幕间、尾声都要有分组。
  const storyGroups = new Set(rules.campaignStory.groups.map(group => group.id))
  for (const id of ['prologue', 'checkpoint1', 'checkpoint2', 'checkpoint3', 'interlude1', 'interlude2', 'interlude3', 'epilogue']) {
    assert.ok(storyGroups.has(id), `战役剧情缺少分组 ${id}`)
  }
  assert.equal(rules.campaignStory.totals.sections,
    rules.campaignStory.groups.reduce((sum, group) => sum + group.summary.total, 0))
  for (const group of rules.campaignStory.groups) {
    for (const section of group.sections) {
      assert.match(section.sourceSha256, /^[0-9a-f]{64}$/)
      assert.equal(section.status, 'pending')
      assert.ok(CHINESE_STATUSES.includes(section.chinese))
      assert.equal(section.specialRule, section.path.startsWith('specialRules.'))
    }
  }

  // 战役记录键从 Key.hs 推导（P1 实测 56 个构造子；P0 规划注释里的 52 已被源事实修正），
  // 且必须与 en/zh base.json 的 key.* 标签叶子数一致，不允许手写卡号式清单。
  const enBase = readJson(join(REFERENCE, 'frontend/src/locales/en/edgeOfTheEarth/base.json'))
  const zhBase = readJson(join(REFERENCE, 'frontend/src/locales/zh/edgeOfTheEarth/base.json'))
  const enKeyLabels = Object.keys(enBase.key || {}).length
  const zhKeyLabels = Object.keys(zhBase.key || {}).length
  assert.equal(rules.recordKeys.totals.keys, 56, 'Key.hs 的 data EdgeOfTheEarthKey 有 56 个构造子')
  assert.equal(rules.recordKeys.keys.length, rules.recordKeys.totals.keys)
  assert.equal(enKeyLabels, rules.recordKeys.totals.keys, '每条记录键都必须有 en key.* 标签')
  assert.equal(zhKeyLabels, rules.recordKeys.totals.withZhLabel, 'withZhLabel 必须等于 zh key.* 标签数')
  assert.equal(rules.recordKeys.totals.withZhLabel + rules.recordKeys.totals.missingZhLabel, rules.recordKeys.totals.keys)
  assert.equal(rules.recordKeys.totals.missingZhLabel, 0)
  assert.match(rules.recordKeys.source, /Campaigns\/EdgeOfTheEarth\/Key\.hs$/)
  assert.match(rules.recordKeys.sha256, /^[0-9a-f]{64}$/)
  for (const entry of rules.recordKeys.keys) {
    assert.match(entry.key, /^[A-Z][A-Za-z0-9_]*$/)
    assert.equal(entry.zhLabelPath, `key.${entry.key.charAt(0).toLowerCase()}${entry.key.slice(1)}`)
    assert.equal(entry.en, true, `${entry.key} 缺少 en 标签`)
  }

  // 9 位探险队伙伴（zh base.json 当前没有 partnerNames，因此全部计入 missingZh，不得漏报）。
  assert.equal(rules.partnerNames.entries.length, 9)
  assert.deepEqual(rules.partnerNames.missingZh, rules.partnerNames.entries.filter(entry => !entry.zh).map(entry => entry.code))
  assert.equal(rules.partnerNames.entries.every(entry => entry.en), true)
  // 7 项探险物资（Supplies.hs → 08614–08620），中文覆盖逐项计算。
  assert.equal(rules.suppliesRecovered.entries.length, 7)
  assert.deepEqual(rules.suppliesRecovered.entries.map(entry => entry.code).sort(),
    ['08614', '08615', '08616', '08617', '08618', '08619', '08620'])
  assert.deepEqual(rules.suppliesRecovered.missingZh, [])

  // 模块确定性：同一来源两次构建必须逐字节一致（账本才能 --check 复算）。
  assert.equal(json(buildGuides()), json(guides))
  assert.equal(json(buildRulesScan()), json(rules))
})
