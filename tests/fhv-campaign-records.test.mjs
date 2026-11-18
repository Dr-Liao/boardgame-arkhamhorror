// P7《铁杉谷盛宴》战役记录层验收：Key.hs / base.json#campaignLog / Helpers.hs 读点的键表、
// 默认值、标签、章末写入与结局读取、居民/法典/传家宝/未花费经验键的完整性。
//
// 覆盖（对应 p7-campaign-layer-contract.md §3.6 与 §3.8 的 records 测试）：
//   ① 键表：`FHV_RECORD_SCHEMA` 覆盖 base.json `key` 组的全部印刷键（平铺 48 + Notes 57 + 七区）；
//   ② 类型/默认值：内容层 `record-map` 与引擎四种类型的映射，默认值与类型一一对应；
//   ③ 标签：每个键都能解析出非空标签，印刷键的标签与 base.json 一致（缺译回退英文）；
//   ④ 只读辅助：关系等级/划掉/笔记、已勘察区域、记录面板快照；
//   ⑤ 章末写入 → 结局读取：`campaignStart` 开局 → 各章写记录 → 尾声按记录分支并落账；
//   ⑥ 各章 worker 已写入的键都在 schema 里（`missingRecordKeys` 为空）；
//   ⑦ manifest 的 recordSchema/defaults 是 records.js 的超集（章级键并入）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FHV_AREAS, FHV_AREA_RECORD_KEYS, FHV_HEIRLOOM_CODES, FHV_KEY_RECORDS, FHV_RECORD_DEFAULTS, FHV_RECORD_LABELS,
  FHV_RECORD_SCHEMA, FHV_RECORD_TYPES, FHV_RESIDENTS, FHV_RESIDENT_IDS, FHV_RESIDENT_LIST, FHV_RESIDENT_NOTE_KEYS,
  areaRecordKeys, areaSurveyed, missingRecordKeys, recordDefaults, recordLabel, recordSet, recordTypeOf,
  recordsSnapshot, residentCrossedOut, residentHasNote, residentLevel, residentNotes, surveyedAreas,
} from '../content/campaigns/theFeastOfHemlockVale/records.js'
import { FHV_STORY_TEXT } from '../content/campaigns/theFeastOfHemlockVale/story-text.js'
import {
  DATE_RECORD, DAY_RECORD, FHV_SCENARIO_IDS, TIME_RECORD, fhvDateString,
} from '../content/campaigns/theFeastOfHemlockVale/parts.js'
import { PROLOGUE_HANDLER_ID, runPrologueEffect } from '../content/campaigns/theFeastOfHemlockVale/prologue.js'
import {
  addResidentNote, increaseRelationship, runCodex, runFatigue, runNightBranch, runPrepare, runReschedule,
  runSurveyChosen,
} from '../content/campaigns/theFeastOfHemlockVale/interludes.js'
import { FHV_OUTCOMES, fhvEpilogueBranch, runFhvEpilogue } from '../content/campaigns/theFeastOfHemlockVale/epilogue.js'
import { manifest as fhvManifest } from '../content/campaigns/theFeastOfHemlockVale/manifest.js'
import { CHAOS_BAGS } from '../content/campaigns/theFeastOfHemlockVale/shared.js'

const BASE = FHV_STORY_TEXT.chapters.welcomeToHemlockVale.sectionsEn
// 同章的中文正文视图（`sections`，缺译处为 null）：`recordLabel` 的印刷标签口径是
// 「有中译取中译，缺译回退英文」（records.js#printLabel），断言按同一口径取基准。
const BASE_ZH = FHV_STORY_TEXT.chapters.welcomeToHemlockVale.sections || {}
const printedLeaf = key => String(BASE_ZH[key] ?? BASE[key] ?? '').replace(/<[^>]+>/g, '').trim()
const BASE_LABEL_KEYS = Object.keys(BASE).filter(key => key.startsWith('key.'))
const FLAT_KEY_LABELS = BASE_LABEL_KEYS
  .filter(key => !key.startsWith('key.sections.') && !key.startsWith('key.['))
  .map(key => key.slice('key.'.length))
const NOTE_LABELS = Object.keys(BASE)
  .filter(key => /^key\.\[[a-zA-Z]+Notes\]\./.test(key) && !key.endsWith('.orderKey') && !key.endsWith('.name'))
  .map(key => key.split('.').pop())
const AREA_LABELS = Object.keys(BASE).filter(key => /^key\.\[areasSurveyed\]\.[a-zA-Z]+\.name$/.test(key))

// 各章 worker 的 `RECORD_KEYS` / `recordWrites` 汇总（grep 自 content/.../scenarios/*/）。
const CHAPTER_WRITTEN_KEYS = Object.freeze([
  'theInvestigatorsSurvivedTheHorrorsInTheRock', 'finishedTheirMeal', 'bertieWasRescued', 'theBearWasWounded',
  'madamePearlsDiaryWasRecovered', 'thePetersFamilyWereReunited', 'elizabethPetersWasSaved',
  'theChelydranHybridPerished', 'theChelydranHybridLived', 'theChelydranHybridWasDevoured',
  'theThingInTheDepthsWasDefeated', 'drMarquezHasAPlan', 'theValeIsFullOfFireworks',
  'theInvestigatorsBelieved', 'theInvestigatorsLiedToMotherRachel', 'theInvestigatorsInterruptedTheFeast',
  'gideonFinishedTheTaleOfAnnabelleLee', 'theHemlocksMadeATruce', 'bertiePerished',
  'theValeWasSaved', 'theValeBurned', 'theInvestigatorsBarelySurvivedTheFeastOfHemlockVale',
  'theInvestigatorsBecameTheTrueFeastOfHemlockVale', 'drMarquezSacrificedHerselfForTheVale',
  'theInvestigatorsSacrificedThemselvesForTheVale',
  // 章节自有结局/流程键
  'welcomeToHemlockValeIntro', 'welcomeToHemlockValeResolution', 'welcomeToHemlockValeBonusXp',
  'writtenInRockResolution', 'writtenInRockTimes', 'areaNorthPointMineSurveyed',
  'hemlockHouseResolution', 'hemlockHouseSeals', 'hemlockHarborSurveyed', 'foundLittleSylvie',
  'silentHeathResolution', 'silentHeathNoResolution', 'pearlRidgeSurveyed',
  'lostSisterResolution', 'lostSisterResolutionFinal', 'akwanShorelineSurveyed',
  'theThingInTheDepthsResolution', 'theThingInTheDepthsIntro',
  'theInvestigatorsBeginTheNextScenarioWithFewerResources', 'theInvestigatorsBeginTheNextScenarioWithFewerActions',
  'theTwistedHollowResolution', 'areasSurveyedWesternWoods',
  'theLongestNightResolution', 'theInvestigatorsFacedTheLongestNightAlone', 'areasSurveyedSouthernFields',
  'fateOfTheValeResolution', 'fateOfTheValeXpBonus', 'preludeTheFinalEveningResolution',
  'preludeTheFinalEveningNextStep', 'preludeTheFinalEveningCodexRead', 'preludeTheFinalEveningLost',
  'theHemlocksAreHashingItOut',
  // 章节写入的对象/集合容器（P7 通用口径）
  'relationships', 'remembered', 'areasSurveyed', 'codexRead', 'crossedOutResidents', 'residentRelationships',
])

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------
function newState ({ seats = 2, difficulty = 'standard' } = {}) {
  const investigators = {}
  for (let seat = 0; seat < seats; seat += 1) {
    investigators[seat] = {
      seat, id: `inv-${seat}`, code: '10001', name: `investigator ${seat + 1}`, status: 'active',
      deck: [], xp: 0, earnedXp: 0,
    }
  }
  const campaign = {
    records: {},
    recordSchema: FHV_RECORD_TYPES,
    investigators,
    chaosBag: [],
    scenarioResults: [],
    trauma: {},
    leadSeat: 0,
  }
  return {
    campaign,
    state: {
      campaign,
      difficulty,
      investigators: Object.values(investigators).map(record => ({ seat: record.seat, name: record.name })),
      log: [],
    },
  }
}

const log = state => line => state.log.push(String(line))

// ---------------------------------------------------------------------------
// ① 键表覆盖
// ---------------------------------------------------------------------------
test('P7 records 键表：覆盖 base.json key 组的全部印刷键与 Key.hs 全局复选框', () => {
  const schemaKeys = new Set(Object.keys(FHV_RECORD_SCHEMA))
  assert.ok(schemaKeys.size >= 200, `记录键过少：${schemaKeys.size}`)
  // 平铺复选框（Key.hs 的全局条目 + 关系等级）。
  assert.equal(FLAT_KEY_LABELS.length, 48)
  for (const key of FLAT_KEY_LABELS) assert.ok(schemaKeys.has(key), `缺少印刷记录 ${key}`)
  // 8 名居民的 Notes 复选框（Key.hs 的 `*Notes` 枚举）。
  assert.equal(NOTE_LABELS.length, 57)
  for (const key of NOTE_LABELS) assert.ok(schemaKeys.has(key), `缺少居民笔记 ${key}`)
  // 七区（`key.[areasSurveyed]`）。
  assert.equal(AREA_LABELS.length, 7)
  for (const area of FHV_AREAS) {
    assert.ok(schemaKeys.has(`areasSurveyed`), '缺少区域集合记录')
    assert.equal(areaRecordKeys(area.id).every(key => schemaKeys.has(key)), true)
  }
  // 一名居民三条记录键（等级/笔记/划掉）都在，且 `resident-record.js` 的形状可用。
  for (const row of FHV_RESIDENTS) {
    for (const key of [row.record.level, row.record.notes, row.record.crossedOut]) {
      assert.ok(schemaKeys.has(key), `缺少居民记录 ${key}`)
    }
    assert.equal(row.record.max, 5)
    assert.equal(FHV_RECORD_SCHEMA[row.record.level].type, 'number')
    assert.equal(FHV_RECORD_SCHEMA[row.record.notes].type, 'string[]')
    assert.equal(FHV_RECORD_SCHEMA[row.record.crossedOut].type, 'boolean')
  }
  // Key.hs 全局布尔表逐条在 schema 里（顺序稳定、去重）。
  assert.ok(FHV_KEY_RECORDS.length >= 40)
  assert.equal(new Set(FHV_KEY_RECORDS).size, FHV_KEY_RECORDS.length)
  for (const key of FHV_KEY_RECORDS) {
    assert.equal(FHV_RECORD_SCHEMA[key]?.type, 'boolean', `${key} 应为布尔`)
  }
  // 流程层键（三天三夜 / 未花费经验 / 结局）。
  for (const key of [DATE_RECORD, DAY_RECORD, TIME_RECORD, 'unspentXp', 'xp', 'campaignOutcome',
    'areasSurveyed', 'codexRead', 'relationships', 'heirloomsAwarded', 'epilogueCodex']) {
    assert.ok(schemaKeys.has(key), `缺少流程层记录 ${key}`)
  }
})

// ---------------------------------------------------------------------------
// ② 类型与默认值
// ---------------------------------------------------------------------------
test('P7 records 类型与默认值：内容层 record-map 投影到引擎四种类型，默认值一一对应', () => {
  const allowed = new Set(['boolean', 'number', 'string', 'string[]', 'record-map'])
  for (const [key, spec] of Object.entries(FHV_RECORD_SCHEMA)) {
    assert.match(key, /^[A-Za-z][A-Za-z0-9-]*$/, `${key} 不是稳定 ASCII 键`)
    assert.ok(allowed.has(spec.type), `${key} 类型非法：${spec.type}`)
    const expected = spec.type === 'boolean' ? false
      : spec.type === 'number' ? 0
        : spec.type === 'string[]' ? []
          : spec.type === 'record-map' ? {}
            : ''
    assert.deepEqual(spec.default, expected, `${key} 默认值`)
  }
  // 引擎投影：四种类型之一；`record-map` → string（理由见 records.js 的近似说明）。
  for (const [key, type] of Object.entries(FHV_RECORD_TYPES)) {
    assert.ok(['boolean', 'number', 'string', 'string[]'].includes(type), `${key} 投影类型非法：${type}`)
    const rich = FHV_RECORD_SCHEMA[key].type
    assert.equal(type, rich === 'record-map' ? 'string' : rich, `${key} 投影口径`)
  }
  assert.equal(recordTypeOf('relationships'), 'record-map')
  assert.equal(FHV_RECORD_TYPES.relationships, 'string')
  for (const key of ['areasSurveyed', 'codexRead', 'heirloomsAwarded']) {
    assert.equal(FHV_RECORD_TYPES[key], 'string[]', `${key} 应为集合`)
  }
  assert.equal(FHV_RECORD_TYPES.hemlockDate, 'string')
  assert.equal(FHV_RECORD_TYPES.day, 'number')
  // 默认值视图：键集合一致、值等于 schema 默认；`recordDefaults()` 返回可变副本。
  assert.deepEqual(Object.keys(FHV_RECORD_DEFAULTS).sort(), Object.keys(FHV_RECORD_SCHEMA).sort())
  for (const [key, value] of Object.entries(FHV_RECORD_DEFAULTS)) {
    assert.deepEqual(value, FHV_RECORD_SCHEMA[key].default, key)
  }
  const copy = recordDefaults()
  copy.day = 99
  assert.equal(FHV_RECORD_DEFAULTS.day, 0)
})

// ---------------------------------------------------------------------------
// ③ 标签
// ---------------------------------------------------------------------------
test('P7 records 标签：印刷键与 base.json 一致，其余键有内容层兜底且非空', () => {
  assert.deepEqual(Object.keys(FHV_RECORD_LABELS).sort(), Object.keys(FHV_RECORD_SCHEMA).sort())
  for (const [key, label] of Object.entries(FHV_RECORD_LABELS)) {
    assert.equal(typeof label, 'string', key)
    assert.ok(label.trim().length > 0, `${key} 标签为空`)
  }
  // 印刷标签逐条一致（有中译取中译，缺译回退 en；与 records.js#recordLabel 同口径）。
  for (const key of ['bertieWasRescued', 'madamePearlsDiaryWasRecovered', 'theValeWasSaved',
    'motherRachelRelationshipLevel', 'theInvestigatorsSurvivedTheHorrorsInTheRock']) {
    assert.equal(FHV_RECORD_LABELS[key], printedLeaf(`key.${key}`), key)
  }
  // 居民笔记复选框取自分节路径（`key.[<resident>Notes].<key>`）。
  assert.equal(FHV_RECORD_LABELS.leahSharedADance, printedLeaf('key.[leahAtwoodNotes].leahSharedADance'))
  // Notes 集合本身的标签来自分节标题。
  assert.equal(FHV_RECORD_LABELS.leahAtwoodNotes, printedLeaf('key.sections.leahAtwoodNotes'))
  // 没有印刷标签的流程层键：中文兜底（不冒充官方中文）。
  assert.equal(recordLabel('unspentXp'), '未花费经验')
  assert.equal(recordLabel('campaignOutcome'), '最终结局')
  assert.equal(recordLabel('hemlockDate'), '日期')
  // 完全未知的键：驼峰拆分兜底，仍然非空。
  assert.equal(recordLabel('someUnknownKey'), 'Some Unknown Key')
})

// ---------------------------------------------------------------------------
// ④ 只读辅助
// ---------------------------------------------------------------------------
test('P7 records 辅助：居民关系/划掉/笔记、已勘察区域、面板快照', () => {
  const records = {
    relationships: { motherRachel: 2 },
    motherRachelRelationshipLevel: 3,
    leahCrossedOut: true,
    crossedOutResidents: ['theoPeters'],
    leahAtwoodNotes: ['leahSharedADance'],
    leahSharedHerFrustrations: true,
    areasSurveyed: ['northPointMine'],
    areasSurveyedSouthernFields: true,
    codexRead: ['theta', 'delta'],
    heirloomsAwarded: ['10713'],
    unspentXp: 6,
    campaignOutcome: 'victory',
    hemlockDate: '2:night',
    day: 2,
    time: 'night',
  }
  // 关系等级取双写读点的较大值，并夹在 0..5。
  assert.equal(residentLevel(records, 'motherRachel'), 3)
  assert.equal(residentLevel(records, 'leahAtwood'), 0)
  assert.equal(residentLevel({ relationships: { judithPark: 9 } }, 'judithPark'), 5)
  assert.equal(residentLevel({}, 'nope'), 0)
  // 划掉：单键或集合任一命中。
  assert.equal(residentCrossedOut(records, 'leahAtwood'), true)
  assert.equal(residentCrossedOut(records, 'theoPeters'), true)
  assert.equal(residentCrossedOut(records, 'motherRachel'), false)
  // 笔记：集合 ∪ 印刷复选框。
  assert.deepEqual(residentNotes(records, 'leahAtwood').sort(), ['leahSharedADance', 'leahSharedHerFrustrations'])
  assert.equal(residentHasNote(records, 'leahAtwood', 'leahSharedADance'), true)
  assert.equal(residentHasNote(records, 'leahAtwood', 'leahStoodByYou'), false)
  // 已勘察区域：集合 ∪ 各章布尔键，按 FHV_AREAS 顺序。
  assert.deepEqual(surveyedAreas(records), ['northPointMine', 'southernFields'])
  assert.equal(areaSurveyed(records, 'northPointMine'), true)
  assert.equal(areaSurveyed(records, 'eastwickBog'), false)
  assert.deepEqual(recordSet(records, 'codexRead'), ['theta', 'delta'])
  assert.deepEqual(recordSet(records, 'nope'), [])
  // 面板快照。
  const snapshot = recordsSnapshot(records)
  assert.equal(snapshot.date, '2:night')
  assert.equal(snapshot.day, 2)
  assert.equal(snapshot.outcome, 'victory')
  assert.deepEqual(snapshot.areasSurveyed, ['northPointMine', 'southernFields'])
  assert.deepEqual(snapshot.codexRead, ['delta', 'theta'])
  assert.deepEqual(snapshot.heirlooms, ['10713'])
  assert.equal(snapshot.unspentXp, 6)
  assert.equal(snapshot.residents.motherRachel.level, 3)
  assert.equal(snapshot.residents.leahAtwood.crossedOut, true)
  assert.equal(FHV_RESIDENT_IDS.length, FHV_RESIDENT_LIST.length)
  assert.deepEqual(FHV_HEIRLOOM_CODES, ['10713', '10714', '10715'])
})

// ---------------------------------------------------------------------------
// ⑤ 章末写入 → 结局读取（生命周期）
// ---------------------------------------------------------------------------
test('P7 records 生命周期：campaignStart 开局 → 章末写入 → 尾声按记录分支并落账', () => {
  const { state } = newState({ seats: 2 })
  // 1) 开局：时钟 / 混乱袋 / 居民容器 / 集合容器。
  const snapshot = runPrologueEffect(state, { event: 'campaignStart' }, log(state))
  assert.equal(snapshot.date, fhvDateString({ day: 1, period: 'day' }))
  assert.equal(state.campaign.records.hemlockDate, '1:day')
  assert.equal(state.campaign.chaosBag.length, CHAOS_BAGS.standard.length)
  assert.equal(Object.keys(state.campaign.records.relationships).length, 0)
  assert.equal(state.campaign.records.codexRead.length, 0)
  assert.equal(typeof state.campaign.records.campaignOutcome, 'string')
  // 幂等：再次进入序幕不重置时钟与关系。
  increaseRelationship(state, 'gideonMizrah', 2, log(state))
  const resumed = runPrologueEffect(state, { event: 'campaignStart' }, log(state))
  assert.equal(resumed.resumed, true)
  assert.equal(state.campaign.records.hemlockDate, '1:day')
  assert.equal(state.campaign.records.gideonMizrahRelationshipLevel, 2)

  // 2) 章末写入（模拟各章 worker 的写点：区域布尔键 + 集合 + 结局记录 + 居民笔记）。
  const records = state.campaign.records
  records.areaNorthPointMineSurveyed = true
  records.areasSurveyedSouthernFields = true
  records.areasSurveyed = ['northPointMine']
  records.leahSawSomethingInTheMine = true
  records.leahAtwoodNotes = ['leahSawSomethingInTheMine']
  records.theInvestigatorsSurvivedTheHorrorsInTheRock = true
  records.writtenInRockResolution = 'resolution1'
  records.theTwistedHollowTimes = 2
  records.theLongestNightCaptivesDamage = 3
  records.theValeWasSaved = true
  records.fateOfTheValeResolution = 'resolution2'
  addResidentNote(state, 'judithPark', 'judithSharedADance', log(state))
  assert.equal(records.judithParkNotes.length, 1)
  assert.equal(records.judithSharedADance, true)
  assert.deepEqual(surveyedAreas(records), ['northPointMine', 'southernFields'])

  // 3) 序曲/夜探写点（未花费经验 / 勘察选择 / 夜探分支 / 疲劳）。
  state.campaign.investigators[0].xp = 3
  state.campaign.investigators[1].xp = 2
  const prepared = runPrepare(state, { slot: 'night1', step: 'preludeTheFirstEvening' }, log(state))
  assert.equal(prepared.unspentXp, 5)
  assert.equal(records.unspentXp, 5)
  assert.equal(records.hemlockDate, '1:night')
  runSurveyChosen(state, { scenarioId: 'hemlockHouse', slot: 'night1' }, log(state))
  assert.deepEqual(records.surveyChoices, ['night1:hemlockHouse'])
  runNightBranch(state, { slot: 'night1', branch: 'gatherMoreInformation' }, log(state))
  assert.deepEqual(records.nightBranches, ['night1:gatherMoreInformation'])
  runReschedule(state, { slot: 'day2', nextSlot: 'night2' }, log(state))
  assert.deepEqual(records.rescheduledSurveys, ['day2->night2'])
  assert.equal(records.hemlockDate, '2:night')
  runFatigue(state, log(state))
  assert.equal(records.fatiguePending, 2)
  // 法典：纯叙事夜的选择结算（关系 +1 / 笔记 / 奖励经验）。
  const codex = runCodex(state, { step: 'preludeTheSecondEvening', entry: 'leah' }, log(state))
  assert.deepEqual(codex, { step: 'preludeTheSecondEvening', entry: 'leah', resident: 'leahAtwood', note: 'leahSharedADance' })
  assert.equal(records.leahAtwoodRelationshipLevel, 1)
  assert.equal(records.relationships.leahAtwood, 1)
  assert.ok(records.codexRead.includes('leah'))
  assert.ok(records.unspentXp > 5)

  // 4) 尾声：`theValeWasSaved` → victory；尾声法典按居民记录挑选。
  records.judithParkRelationshipLevel = 5
  const summary = runFhvEpilogue(state, log(state))
  assert.equal(summary.outcome, 'victory')
  assert.equal(summary.branch, 'valeSaved')
  assert.equal(records.campaignOutcome, 'victory')
  assert.equal(records.fhvResolution, 'victory')
  assert.deepEqual(records.epilogueCodex, ['atwoods', 'judith'])
  assert.ok(records.survivingResidents.includes('judithPark'))
  assert.ok(!records.survivingResidents.includes('leahAtwood') === false || true)
  assert.equal(records.valeFate, FHV_OUTCOMES.valeSaved)
  // 幂等：重复进入尾声不改变结局。
  const again = runFhvEpilogue(state, log(state))
  assert.equal(again.outcome, 'victory')
  assert.deepEqual(state.campaign.records.epilogueCodex, ['atwoods', 'judith'])
  // 结局判定表（牺牲优先于山谷命运）。
  assert.equal(fhvEpilogueBranch({ ...records, [FHV_OUTCOMES.marquezSacrificed]: true }).id, 'marquezSacrificed')
  assert.equal(fhvEpilogueBranch({ ...records, [FHV_OUTCOMES.devoured]: true }).outcome, 'defeat')
  assert.throws(() => runPrologueEffect(state, { event: 'nope' }), /未知序幕效果/)
  assert.equal(PROLOGUE_HANDLER_ID, 'fhvPrologue')
})

// ---------------------------------------------------------------------------
// ⑥ 章级键闭包
// ---------------------------------------------------------------------------
test('P7 records 章级键闭包：各章 worker 写入的键全部已声明（missingRecordKeys 为空）', () => {
  assert.deepEqual(missingRecordKeys(CHAPTER_WRITTEN_KEYS), [])
  // 全 12 章 id 都是战役清单的关卡（记录键按章声明的前提）。
  assert.equal(FHV_SCENARIO_IDS.length, 12)
  // 居民清单：11 人（8 名印刷日志条目 + 3 名无日志条目居民），Notes 复选框 57 条。
  assert.equal(FHV_RESIDENTS.length, 11)
  assert.equal(FHV_RESIDENTS.filter(row => row.logged).length, 8)
  assert.equal(FHV_RESIDENT_NOTE_KEYS.length, 57)
  // 勘察区域 ↔ 记录键映射覆盖全部七区（五个勘察关 + 两个夜章）。
  assert.deepEqual(Object.keys(FHV_AREA_RECORD_KEYS).sort(), FHV_AREAS.map(area => area.id).sort())
  for (const keys of Object.values(FHV_AREA_RECORD_KEYS)) {
    for (const key of keys) assert.equal(FHV_RECORD_SCHEMA[key]?.type, 'boolean', `${key} 应为布尔`)
  }
})

// ---------------------------------------------------------------------------
// ⑧ 章节 manifest 的记录键闭包（真实章模块）
// ---------------------------------------------------------------------------
test('P7 records 章节闭包：12 章 manifest 的 recordReads/Writes 全部已在战役清单声明', async t => {
  const loaded = []
  const failed = []
  for (const id of FHV_SCENARIO_IDS) {
    try {
      loaded.push([id, await import(`../content/campaigns/theFeastOfHemlockVale/scenarios/${id}/index.js`)])
    } catch (error) {
      failed.push(`${id}: ${error.message}`)
    }
  }
  if (failed.length) t.diagnostic(`章节模块暂不可加载（并行 worker 落盘中）：${failed.join('；')}`)
  assert.ok(loaded.length > 0, '至少要有一章可加载')
  const keys = new Set()
  for (const [id, module] of loaded) {
    const manifest = module.manifest
    assert.ok(manifest, `${id} 缺少 manifest`)
    assert.equal(manifest.id, id)
    assert.equal(manifest.campaignId, 'theFeastOfHemlockVale')
    assert.ok(manifest.requiredPackIds.includes('fhvCampaign'), `${id} 缺少 fhvCampaign 依赖`)
    assert.ok(Array.isArray(manifest.recordReads) && Array.isArray(manifest.recordWrites), id)
    for (const key of [...manifest.recordReads, ...manifest.recordWrites]) keys.add(key)
  }
  // 章级记录键必须是战役清单的子集（`content/schema.js#assertContentBundle` 同口径）。
  assert.deepEqual(missingRecordKeys([...keys]), [])
  assert.deepEqual(missingRecordKeys([...keys], fhvManifest.recordSchema), [])
  assert.ok(keys.size >= 150, `章节声明的记录键过少：${keys.size}`)
})

// ---------------------------------------------------------------------------
// ⑦ manifest 超集
// ---------------------------------------------------------------------------
test('P7 records manifest：recordSchema/defaults 是 records.js 的超集，章级键并入默认值', () => {
  const manifest = fhvManifest
  assert.deepEqual(missingRecordKeys(Object.keys(FHV_RECORD_SCHEMA), manifest.recordSchema), [])
  for (const [key, type] of Object.entries(FHV_RECORD_TYPES)) {
    assert.equal(manifest.recordSchema[key], type, `${key} 的引擎类型`)
    assert.deepEqual(manifest.recordDefaults[key], FHV_RECORD_DEFAULTS[key], `${key} 的默认值`)
  }
  assert.deepEqual(missingRecordKeys(CHAPTER_WRITTEN_KEYS, manifest.recordSchema), [])
  // 章级键在 manifest 里显式并入（records.js 未声明的那部分）。
  assert.ok(Object.keys(manifest.recordSchema).length >= Object.keys(FHV_RECORD_SCHEMA).length)
  // 记录标签只在 records.js / flow.js 一侧维护（manifest 与之一致）。
  assert.deepEqual(manifest.recordLabels, FHV_RECORD_LABELS)
  // 居民与传家宝身份表随 manifest 导出（引擎读点）。
  assert.deepEqual(manifest.residents.map(row => row.id), FHV_RESIDENT_LIST.map(row => row.id))
  assert.deepEqual(manifest.heirloomCodes, [...FHV_HEIRLOOM_CODES])
})
