// 《铁杉谷盛宴》（The Feast of Hemlock Vale）· 战役记录键 / 标签 / 默认值（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheFeastOfHemlockVale/Key.hs`（`TheFeastOfHemlockValeKey` 复选框、8 名居民的
//     `*Notes` 子表、`AreasSurveyed` 枚举）；
//   · 英文指南 `frontend/src/locales/en/theFeastOfHemlockVale/base.json` 的 `key` 组（Campaign Log 的
//     印刷标签逐键一条：`key.<key>`、`key.[<居民>Notes].<key>`、`key.[areasSurveyed].<area>.name`）；
//   · `Campaigns/TheFeastOfHemlockVale/Helpers.hs` 的读点（`getRelationshipLevel`/`getCrossedOutResidents`/
//     `getAreasSurveyed`/`getHasRecord`）；
//   · 各章 worker 已写入的键：`content/campaigns/theFeastOfHemlockVale/scenarios/*/{definition,behavior,index}.js`
//     的 `RECORD_KEYS` / `recordReads` / `recordWrites` 汇总（P7 只做汇总声明，不改章节文件）。
//
// 三层视图（与 TSK 的 records.js 同一分工）：
//   1. `FHV_RECORD_SCHEMA`：内容层「类型 + 默认值」视图。类型取值 `boolean | number | string | string[]`
//      **外加** `record-map`（对象 Map 键，如 `relationships` / `remembered` / `residentRelationships`）。
//   2. `FHV_RECORD_TYPES`：引擎口径投影（`content/schema.js#assertCampaignManifest` 与
//      `src/campaign/campaign-flow.js#validateCampaignGraph` 只接受四种类型）。`record-map` 投影为
//      `string`（见 §3 的近似说明）。
//   3. `FHV_RECORD_LABELS`：标签，优先读 story-text 的 `key/*` 印刷标签（`chapterText(..., 'zh')`
//      在缺译时回退英文），缺标签时用本文件的中文兜底（内容层命名，**不冒充**官方中文）。
//
// 本文件不写 state、不注册效果、不依赖引擎状态形状；只提供可序列化数据与只读辅助。
import { chapterText } from './story-access.js'

export const FHV_CAMPAIGN_ID = 'theFeastOfHemlockVale'

// 标签正文所在章节：4 段叙事序曲共用 base.json（726 条叶子），`key` 组只在这四章里。
const LABEL_CHAPTER = 'welcomeToHemlockVale'

// ---------------------------------------------------------------------------
// 1. 居民（Key.hs 的 8 张 Campaign Log 居民条目 + 3 名无印刷日志条目的居民）
// ---------------------------------------------------------------------------
// 记录键与 base.json `key.sections.*` / `Key.hs` 同名：`<id>RelationshipLevel` / `<id>Notes` /
// `<id>CrossedOut`。`src/engine/resident-record.js#normalizeResidentRecord` 的居民清单形状是
// `{ level, notes, crossedOut, max }`，这里的 `record` 直接可作该原语的输入。
export const FHV_RESIDENT_MAX_LEVEL = 5

const resident = (id, name, nameEn, record, { logged = true } = {}) => Object.freeze({
  id,
  name,
  nameEn,
  logged,
  record: record && Object.freeze({ ...record, max: FHV_RESIDENT_MAX_LEVEL }),
})

export const FHV_RESIDENTS = Object.freeze([
  resident('motherRachel', '蕾切尔嬷嬷', 'Mother Rachel',
    { level: 'motherRachelRelationshipLevel', notes: 'motherRachelNotes', crossedOut: 'motherRachelCrossedOut' }),
  resident('leahAtwood', '莉亚·阿特伍德', 'Leah Atwood',
    { level: 'leahAtwoodRelationshipLevel', notes: 'leahAtwoodNotes', crossedOut: 'leahCrossedOut' }),
  resident('simeonAtwood', '西米恩·阿特伍德', 'Simeon Atwood',
    { level: 'simeonAtwoodRelationshipLevel', notes: 'simeonAtwoodNotes', crossedOut: 'simeonCrossedOut' }),
  resident('williamHemlock', '威廉·赫姆洛克', 'William Hemlock',
    { level: 'williamHemlockRelationshipLevel', notes: 'williamHemlockNotes', crossedOut: 'williamCrossedOut' }),
  resident('riverHawthorne', '里弗·霍桑', 'River Hawthorne',
    { level: 'riverHawthorneRelationshipLevel', notes: 'riverHawthorneNotes', crossedOut: 'riverCrossedOut' }),
  resident('gideonMizrah', '吉迪恩·米兹拉', 'Gideon Mizrah',
    { level: 'gideonMizrahRelationshipLevel', notes: 'gideonMizrahNotes', crossedOut: 'gideonCrossedOut' }),
  resident('judithPark', '朱迪思·帕克', 'Judith Park',
    { level: 'judithParkRelationshipLevel', notes: 'judithParkNotes', crossedOut: 'judithCrossedOut' }),
  resident('theoPeters', '西奥·彼得斯', 'Theo Peters',
    { level: 'theoPetersRelationshipLevel', notes: 'theoPetersNotes', crossedOut: 'theoCrossedOut' }),
  // 三名「没有印刷 Campaign Log 分节」的居民：只有关系等级（剧情资产/敌人翻面），没有 Notes 复选框。
  resident('bertieMusgrave', '伯蒂·马斯格雷夫', 'Bertie Musgrave',
    { level: 'bertieMusgraveRelationshipLevel', notes: 'bertieMusgraveNotes', crossedOut: 'bertieCrossedOut' }, { logged: false }),
  resident('drRosaMarquez', '罗莎·马奎兹博士', 'Dr. Rosa Marquez',
    { level: 'drRosaMarquezRelationshipLevel', notes: 'drRosaMarquezNotes', crossedOut: 'drRosaMarquezCrossedOut' }, { logged: false }),
  resident('helenPeters', '海伦·彼得斯', 'Helen Peters',
    { level: 'helenPetersRelationshipLevel', notes: 'helenPetersNotes', crossedOut: 'helenPetersCrossedOut' }, { logged: false }),
])

export const FHV_RESIDENT_IDS = Object.freeze(FHV_RESIDENTS.map(row => row.id))
export const FHV_RESIDENT_BY_ID = Object.freeze(Object.fromEntries(FHV_RESIDENTS.map(row => [row.id, row])))

/**
 * 居民记录的**别名键**（章节 worker 的既有写法，必须一并声明，否则
 * `content/schema.js#assertContentBundle` 会判定「未声明战役记录」）：
 *   · `<全名>Relationship`（= `<id>RelationshipLevel` 的别名，number）；
 *   · `<全名>CrossedOut`（= Key.hs 的短名 `gideonCrossedOut` 等，boolean）。
 * 读点统一走 `residentLevel` / `residentCrossedOut`（两种写法取并集）。
 */
export const FHV_RESIDENT_ALIASES = Object.freeze({
  motherRachel: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze([]) }),
  leahAtwood: Object.freeze({ level: Object.freeze(['leahAtwoodRelationship']), crossedOut: Object.freeze(['leahAtwoodCrossedOut']) }),
  simeonAtwood: Object.freeze({ level: Object.freeze(['simeonAtwoodRelationship']), crossedOut: Object.freeze(['simeonAtwoodCrossedOut']) }),
  williamHemlock: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze(['williamHemlockCrossedOut']) }),
  riverHawthorne: Object.freeze({ level: Object.freeze(['riverHawthorneRelationship']), crossedOut: Object.freeze(['riverHawthorneCrossedOut']) }),
  gideonMizrah: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze(['gideonMizrahCrossedOut']) }),
  judithPark: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze(['judithParkCrossedOut']) }),
  theoPeters: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze(['theoPetersCrossedOut']) }),
  bertieMusgrave: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze([]) }),
  drRosaMarquez: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze([]) }),
  helenPeters: Object.freeze({ level: Object.freeze([]), crossedOut: Object.freeze([]) }),
})

// 别名键 → 类型（供 schema 生成；别名不参与「居民清单」的 record 形状）。
const aliasRecordTypes = () => {
  const types = {}
  for (const aliases of Object.values(FHV_RESIDENT_ALIASES)) {
    for (const key of aliases.level) types[key] = 'number'
    for (const key of aliases.crossedOut) types[key] = 'boolean'
  }
  return types
}

/** 引擎 `resident-record.js` 的 `mechanics.residents` 声明（内容层清单；章节 definition 也可以内联）。 */
export const FHV_RESIDENT_LIST = Object.freeze(FHV_RESIDENTS.map(row => Object.freeze({
  id: row.id, name: row.name, nameEn: row.nameEn, record: Object.freeze({ ...row.record }),
})))

// 每名居民的 Campaign Log 复选框（Key.hs 的 `*Notes` 枚举；base.json `key.[<id>Notes].*`）。
// 这些键在引擎里是**集合**（`resident-record.js#changeResidentNote` → `record-sets.js`）的取值，
// 但印刷日志把它们画成独立复选框，故本文件同时声明：`<id>Notes` 为 string[]、每个复选框为 boolean。
export const FHV_RESIDENT_NOTES = Object.freeze({
  motherRachel: Object.freeze(['motherRachelIntervened', 'motherRachelSharedHerDoubts', 'motherRachelCrossedOut']),
  leahAtwood: Object.freeze(['leahIsSearchingForSimeon', 'leahSharedADance', 'leahSharedHerFrustrations',
    'leahSawSomethingInTheMine', 'leahAndSimeonWereReunited', 'leahSearchedThePearlRuins', 'leahStoodByYou',
    'leahSacrificedThemselvesForTheInvestigators', 'leahCrossedOut']),
  simeonAtwood: Object.freeze(['simeonSurvived', 'simeonDisappeared', 'simeonHatchedAPlan', 'thePlanIsUnderway',
    'simeonSharedADance', 'simeonStoodByYou', 'simeonSacrificedThemselvesForTheInvestigators', 'simeonCrossedOut']),
  williamHemlock: Object.freeze(['williamTookHeart', 'williamSharedHisLegacy', 'williamSharedADance',
    'williamStoodByYou', 'williamIsResolved', 'williamSacrificedThemselvesForTheInvestigators', 'williamCrossedOut']),
  riverHawthorne: Object.freeze(['theSchemeIsInMotion', 'riverSharedTheirAmbitions', 'riverAskedForHelp',
    'riverSharedADance', 'riverStoodByYou', 'riverIsReclaimingTheirLegacy',
    'riverSacrificedThemselvesForTheInvestigators', 'riverCrossedOut']),
  gideonMizrah: Object.freeze(['gideonToldTheStoryOfCaptainHemlock', 'gideonToldTheTaleOfTheAnnabelleLee',
    'gideonFoundHisTreasure', 'gideonSharedADance', 'gideonStoodByYou',
    'gideonSacrificedThemselvesForTheInvestigators', 'gideonCrossedOut']),
  judithPark: Object.freeze(['judithSavedYourAss', 'judithSharedAGrudge', 'judithSharedADance', 'judithStoodByYou',
    'youBackedJudithUp', 'judithSacrificedThemselvesForTheInvestigators', 'judithCrossedOut']),
  theoPeters: Object.freeze(['theoReconciledWithHelen', 'theoDistractedTheBear', 'theoSharedADance',
    'theoRejectedHisFamily', 'theoStoodByYou', 'theoIsHavingSecondThoughts',
    'theoSacrificedThemselvesForTheInvestigators', 'theoCrossedOut']),
})

/** 所有居民的 Notes 复选框键（单卡条目/章节行为写布尔值的那些键）。 */
export const FHV_RESIDENT_NOTE_KEYS = Object.freeze(
  [...new Set(Object.values(FHV_RESIDENT_NOTES).flat())].sort())

/**
 * Notes 分节里**不是布尔**的键：`thePlanIsUnderway` 在西米恩分节里被画成复选格，但最终日黎明按
 * tally 数字累加（`planTally`/`addPlanTally`），引擎口径为 number（见 §3b CHAPTER_RECORDS）。
 */
export const FHV_NOTE_TALLY_KEYS = Object.freeze(['thePlanIsUnderway'])

// ---------------------------------------------------------------------------
// 2. 勘察区域（Key.hs 的 `AreasSurveyed` 枚举 + base.json `key.[areasSurveyed]`）
// ---------------------------------------------------------------------------
// 章节 worker 对同一区域写了**不同形状**的记录键（见 §5 的映射表）：
//   · `writtenInRock` → `areaNorthPointMineSurveyed`；`preludeTheFinalEvening` 读 `areasSurveyedNorthPointMine`；
//   · `theTwistedHollow` → `areasSurveyedWesternWoods`；`theLongestNight` → `areasSurveyedSouthernFields`；
//   · `hemlockHouse`/`theLostSister`/`theSilentHeath` → `<area>Surveyed`；
//   · 另外三章把区域名写进集合 `areasSurveyed`（`record-sets.js` 口径）。
// 战役层统一以「集合 `areasSurveyed` ∪ 各章布尔键」判定，见 §5 的 `surveyedAreas`。
export const FHV_AREAS = Object.freeze([
  Object.freeze({ id: 'northPointMine', nameEn: 'North Point Mine', scenarioId: 'writtenInRock', ref: 'p10' }),
  Object.freeze({ id: 'hemlockHarbor', nameEn: 'Hemlock Harbor', scenarioId: 'hemlockHouse', ref: 'p14' }),
  Object.freeze({ id: 'pearlRidge', nameEn: 'Pearl Ridge', scenarioId: 'theSilentHeath', ref: 'p19' }),
  Object.freeze({ id: 'akwanShoreline', nameEn: 'Akwan Shoreline', scenarioId: 'theLostSister', ref: 'p23' }),
  Object.freeze({ id: 'eastwickBog', nameEn: 'Eastwick Bog', scenarioId: 'theThingInTheDepths', ref: 'p27' }),
  Object.freeze({ id: 'westernWoods', nameEn: 'Western Woods', scenarioId: 'theTwistedHollow', ref: 'p34' }),
  Object.freeze({ id: 'southernFields', nameEn: 'Southern Fields', scenarioId: 'theLongestNight', ref: 'p46' }),
])
export const FHV_AREA_IDS = Object.freeze(FHV_AREAS.map(area => area.id))
export const FHV_AREA_BY_SCENARIO = Object.freeze(Object.fromEntries(FHV_AREAS.map(area => [area.scenarioId, area])))
// 五个「勘察关卡」（序曲里可以自由选择的白日/夜探勘察章；westernWoods/southernFields 是固定夜章）。
export const FHV_SURVEY_AREA_IDS = Object.freeze(['northPointMine', 'hemlockHarbor', 'pearlRidge', 'akwanShoreline', 'eastwickBog'])

// 每个区域可能被写到的布尔记录键（章节 worker 的既有写法，全部登记；`null` 表示只用集合）。
export const FHV_AREA_RECORD_KEYS = Object.freeze({
  northPointMine: Object.freeze(['areaNorthPointMineSurveyed', 'areasSurveyedNorthPointMine']),
  hemlockHarbor: Object.freeze(['hemlockHarborSurveyed']),
  pearlRidge: Object.freeze(['pearlRidgeSurveyed']),
  akwanShoreline: Object.freeze(['akwanShorelineSurveyed']),
  eastwickBog: Object.freeze([]),
  westernWoods: Object.freeze(['areasSurveyedWesternWoods']),
  southernFields: Object.freeze(['areasSurveyedSouthernFields']),
})

// ---------------------------------------------------------------------------
// 3. 记录键表
// ---------------------------------------------------------------------------
// 3a. 战役流程层（战役层自己读写；Key.hs 里没有印刷复选框）
const FLOW_RECORDS = Object.freeze({
  day: 'number', // 当前天数 1–3（与 hemlockDate 同步；章节 chaos.js 的 [skull] 读它）
  time: 'string', // 'Day' | 'Night'（章节按印刷文本读；引擎 scenario-calendar 用 hemlockDate）
  hemlockDate: 'string', // `day:period`（scenario-calendar.js#setScenarioDate 的存档形状）
  timeOfDay: 'string', // writtenInRock 读点
  night: 'boolean', // writtenInRock 读点
  leadSeat: 'number',
  areasSurveyed: 'string[]', // 已勘察区域集合（引擎 record-sets 口径）
  relationships: 'record-map', // 居民 id → 关系等级（章节行为写对象）
  residentRelationships: 'record-map', // fateOfTheVale 读点（同上）
  remembered: 'record-map', // 「记住」标记容器（hemlockHouse/theLostSister 写对象）
  codexRead: 'string[]', // 已读法典条目（章节 recordAdd/recordValues）
  crossedOutResidents: 'string[]', // 被划掉的居民 id
  unspentXp: 'number', // 序曲/幕间结算时的「未花费经验」投影（引擎权威存储仍是记录.xp）
  xp: 'number', // 战役总经验（fateOfTheVale/dawnOfTheFinalDay 写）
  campaignOutcome: 'string', // 最终结局标签（epilogue.js#FHV_OUTCOMES）
  heirloomsAwarded: 'string[]', // 已发放传家宝（10713–10715）
  investigatorDefeat: 'string[]', // 最长一夜的阵亡席位
  sacrificedResident: 'string', // 被献祭的居民 id
  surveyChoices: 'string[]', // 每次勘察选择（`<slot>:<scenarioId>`，流程层审计/去重）
  rescheduledSurveys: 'string[]', // 跳过勘察的调度重抽（`<from>-><to>`）
  nightBranches: 'string[]', // 夜探分支（`<slot>:<branch>[:<scenarioId>]`）
  fatiguePending: 'number', // 疲劳待替换的混乱标记数（最长一夜之后）
  epilogueCodex: 'string[]', // 尾声实际写进历史的法典条目 id
  campaignOutcomeBranch: 'string', // 结局分支 id（epilogue.js#FHV_EPILOGUE_BRANCHES / fhvEpilogueBranch）
  fhvResolution: 'string', // `victory` / `defeat`（manifest.resolutionIds 口径）
  valeFate: 'string', // 山谷命运记录（逗号分隔）
  survivingResidents: 'string[]', // 尾声时未被划掉的居民
})

// 传家宝（Heirlooms 组）：白天序曲/幕间的法典小节发放；战役层只登记已发放名单。
export const FHV_HEIRLOOM_CODES = Object.freeze(['10713', '10714', '10715'])

// 3b. 章节结局/流程记录（各章 worker 的 `RECORD_KEYS` 汇总；键名来自 Key.hs 或章节 worker）
const CHAPTER_RECORDS = Object.freeze({
  // 序曲：欢迎来到铁杉谷
  welcomeToHemlockValeIntro: 'string',
  welcomeToHemlockValeChaosToken: 'string',
  welcomeToHemlockValeResolution: 'string',
  welcomeToHemlockValeResolutionReason: 'string',
  welcomeToHemlockValeBonusXp: 'number',
  welcomeToHemlockValeSurveyChoices: 'string[]',
  welcomeToHemlockValeTheBrilliance: 'boolean',
  // 序曲：第二日黎明（章节 worker 的两种写法都登记）
  dawnOfTheSecondDayResolution: 'string',
  dawnOfTheSecondDayResolvedTo: 'string',
  dawnSecondResolution: 'string',
  dawnSecondResolvedTo: 'string',
  hemlockCurseAdded: 'boolean',
  // 最长一夜之后的疲劳是否已结算（章节 worker 写法）
  hemlockFatigueApplied: 'boolean',
  // 家庭重聚（Key.hs 的 were 与章节 worker 的 was 两种写法）
  thePetersFamilyWasReunited: 'boolean',
  // 序曲：最终日黎明 / 最终夜
  dawnOfTheFinalDayResolution: 'string',
  dawnOfTheFinalDayResolvedTo: 'string',
  preludeTheFinalEveningResolution: 'string',
  preludeTheFinalEveningNextStep: 'string',
  preludeTheFinalEveningCodexRead: 'string[]',
  preludeTheFinalEveningReplayRequested: 'boolean',
  preludeTheFinalEveningLost: 'boolean',
  theHemlocksAreHashingItOut: 'boolean',
  youAreRunningAnErrand: 'boolean',
  youAreDeliveringAPackage: 'boolean',
  // 岩间密语
  writtenInRockResolution: 'string',
  writtenInRockTimes: 'number',
  writtenInRockBonusXp: 'number',
  prismaticShardToDeck: 'boolean',
  riverHawthorneHelped: 'boolean',
  // 西米恩的「The Plan is Underway」：最终日黎明按 tally **数字**累加（`planTally`/`addPlanTally`），
  // 印刷日志把它画成复选框；`residentNotes` 把正数同样视为已勾选（见 §5）。
  thePlanIsUnderway: 'number',
  // 汉洛克庄园
  hemlockHouseResolution: 'string',
  hemlockHouseResolutionEntry: 'string',
  hemlockHouseSeals: 'number',
  hemlockHouseEnemyLocations: 'number',
  hemlockHouseBonusXp: 'number',
  hemlockHousePredationTokens: 'number',
  hemlockHouseLittleSylvie: 'boolean',
  foundLittleSylvie: 'boolean',
  youAreHelpingGideon: 'boolean',
  judithIsRemodeling: 'boolean',
  // 寂静荒野
  silentHeathResolution: 'string',
  silentHeathResolvedTo: 'string',
  silentHeathNoResolution: 'boolean',
  silentHeathBonusXp: 'number',
  // 消失的姐妹
  lostSisterDay: 'number',
  lostSisterResolution: 'string',
  lostSisterNoResolution: 'boolean',
  lostSisterResolutionFinal: 'string',
  lostSisterResolutionNext: 'string',
  lostSisterBonusXp: 'number',
  // 深沼之物
  theThingInTheDepthsIntro: 'string',
  theThingInTheDepthsResolution: 'string',
  theThingInTheDepthsBonusXp: 'number',
  theInvestigatorsBeginTheNextScenarioWithFewerResources: 'number',
  theInvestigatorsBeginTheNextScenarioWithFewerActions: 'number',
  // 扭曲空洞
  theTwistedHollowResolution: 'string',
  theTwistedHollowTimes: 'number',
  theTwistedHollowBonusXp: 'number',
  // 最长一夜
  theLongestNightResolution: 'string',
  theLongestNightCaptivesDamage: 'number',
  ajaxJoinedTheInvestigators: 'boolean',
  drMarquezJoinedTheInvestigators: 'boolean',
  aResidentWasSacrificed: 'boolean',
  // 山谷的命运
  fateOfTheValeResolution: 'string',
  fateOfTheValeXpBonus: 'number',
  fateInterlude: 'string',
  drMarquezRemovedFromDecks: 'boolean',
  theInvestigatorsAreDoomed: 'boolean',
  theInvestigatorsWereDevoured: 'boolean',
  theInvestigatorsFoundGas: 'boolean',
  theInvestigatorsFoundTheosTruck: 'boolean',
  theRoadIsClear: 'boolean',
  theSurveyNotesWereRecovered: 'boolean',
  bertieIsFleeing: 'boolean',
  theSamplesWereFound: 'boolean',
  // 区域布尔键（章节 worker 的既有写法，见 FHV_AREA_RECORD_KEYS）
  areaNorthPointMineSurveyed: 'boolean',
  areasSurveyedNorthPointMine: 'boolean',
  hemlockHarborSurveyed: 'boolean',
  pearlRidgeSurveyed: 'boolean',
  akwanShorelineSurveyed: 'boolean',
  areasSurveyedWesternWoods: 'boolean',
  areasSurveyedSouthernFields: 'boolean',
})

// 3c. Key.hs 的全局复选框（`TheFeastOfHemlockValeKey` 的非居民条目，全部是布尔）
export const FHV_KEY_RECORDS = Object.freeze([
  'theInvestigatorsSurvivedTheHorrorsInTheRock',
  'theInvestigatorsLaidThePearlFamilyToRest',
  'theRemainsWerePartiallyRecovered',
  'madamePearlsDiaryWasRecovered',
  'thePetersFamilyWereReunited',
  'elizabethPetersWasSaved',
  'theChelydranHybridPerished',
  'theChelydranHybridLived',
  'theChelydranHybridWasDevoured',
  'theThingInTheDepthsWasDefeated',
  'finishedTheirMeal',
  'helenPetersJoinedTheSurvey',
  'motherRachelShowedTheWay',
  'theInvestigatorsLostThePath',
  'bertieWasLostInTheWoods',
  'bertieWasRescued',
  'theBearWasWounded',
  'helenSharedADance',
  'bertieHadAnEpiphany',
  'theInvestigatorsFacedTheLongestNightAlone',
  'theCaptivesWereSaved',
  'manyCaptivesWereLost',
  'allTheCaptivesWereLost',
  'drMarquezHasAPlan',
  'theInvestigatorsLearnedTheirPlace',
  'drMarquesHasAHunch',
  'theValeIsFullOfFireworks',
  'theInvestigatorsBelieved',
  'theInvestigatorsLiedToMotherRachel',
  'theInvestigatorsInterruptedTheFeast',
  'gideonFinishedTheTaleOfAnnabelleLee',
  'theHemlocksMadeATruce',
  'bertiePerished',
  'theInvestigatorsBecameTheTrueFeastOfHemlockVale',
  'drMarquezSacrificedHerselfForTheVale',
  'theInvestigatorsSacrificedThemselvesForTheVale',
  'theValeWasSaved',
  'theValeBurned',
  'theInvestigatorsBarelySurvivedTheFeastOfHemlockVale',
  'helenSacrificedThemselvesForTheInvestigators',
])

const KEY_RECORD_TYPES = Object.freeze(Object.fromEntries(FHV_KEY_RECORDS.map(key => [key, 'boolean'])))

// 3d. 居民记录（等级 number / Notes 集合 string[] / 复选框 boolean / 划掉 boolean）
function residentRecordTypes () {
  const types = {}
  for (const row of FHV_RESIDENTS) {
    types[row.record.level] = 'number'
    types[row.record.notes] = 'string[]'
    types[row.record.crossedOut] = 'boolean'
  }
  for (const key of FHV_RESIDENT_NOTE_KEYS) {
    types[key] = FHV_NOTE_TALLY_KEYS.includes(key) ? 'number' : 'boolean'
  }
  return Object.freeze(types)
}

/** 内容层 schema：`{ key: { type, default } }`；`type` 允许 `record-map`。 */
const defaultFor = type => (type === 'boolean' ? false
  : type === 'number' ? 0
    : type === 'string[]' ? Object.freeze([])
      : type === 'record-map' ? Object.freeze({})
        : '')

const richSchema = types => Object.freeze(Object.fromEntries(
  Object.entries(types).sort(([left], [right]) => left.localeCompare(right)).map(([key, type]) => [
    key, Object.freeze({ type, default: defaultFor(type) }),
  ])))

export const FHV_RECORD_SCHEMA = richSchema({
  ...FLOW_RECORDS,
  ...CHAPTER_RECORDS,
  ...KEY_RECORD_TYPES,
  ...residentRecordTypes(),
  ...aliasRecordTypes(),
})

export const FHV_RECORD_DEFAULTS = Object.freeze(Object.fromEntries(
  Object.entries(FHV_RECORD_SCHEMA).map(([key, spec]) => [key, spec.default])))

/** 引擎口径的类型投影：`record-map` → `string`（见文件头 §3 与下方近似说明）。 */
export const FHV_RECORD_TYPES = Object.freeze(Object.fromEntries(
  Object.entries(FHV_RECORD_SCHEMA).map(([key, spec]) => [key, spec.type === 'record-map' ? 'string' : spec.type])))

// P7 approximation（记录层，必须显式披露）：
//   `record-map` 键（`relationships` / `residentRelationships` / `remembered`）在引擎投影里声明为
//   `string`：`content/schema.js#assertCampaignManifest` 只接受四种类型，而 `src/engine/setup.js` 会用
//   该类型生成默认值。选 `string`（默认 `''`）而不是 `string[]`（默认 `[]`）的原因是章节行为用
//   `records.relationships ||= {}` 首次写入——`[]` 是 truthy，会退化成「往数组上挂属性」。
//   引擎侧没有 flow 效果写这三个键（`validateCampaignGraph` 用 `FHV_RECORD_TYPES`），因此
//   `string` 只承担「键已声明」的闭包作用。

// ---------------------------------------------------------------------------
// 4. 标签
// ---------------------------------------------------------------------------
// 印刷标签路径：平铺键 `key.<key>`；居民 Notes 复选框 `key.[<residentNotes>].<key>`；
// 勘察区域 `key.[areasSurveyed].<area>.name`；关系等级 `key.<levelKey>`。
const AREA_LABELS = Object.freeze(Object.fromEntries(FHV_AREAS.map(area => [
  area.id, Object.freeze({ name: `key.[areasSurveyed].${area.id}.name`, scenarioName: `key.[areasSurveyed].${area.id}.scenarioName` }),
])))

const NOTE_LABEL_PATHS = Object.freeze(Object.fromEntries(Object.entries(FHV_RESIDENT_NOTES)
  .flatMap(([residentId, keys]) => keys.map(key => [key,
    `key.[${FHV_RESIDENT_BY_ID[residentId].record.notes}].${key}`]))))

// 内容层中文兜底（不是官方中文：仅记录面板的键名；印刷标签缺译时使用）。
const FALLBACK_LABELS = Object.freeze({
  day: '天数', time: '时段', hemlockDate: '日期', timeOfDay: '时段', night: '夜晚', leadSeat: '领队座位',
  areasSurveyed: '已勘察区域', relationships: '居民关系', residentRelationships: '居民关系',
  remembered: '记住', codexRead: '已读法典', crossedOutResidents: '被划掉的居民',
  unspentXp: '未花费经验', xp: '经验值', campaignOutcome: '最终结局', heirloomsAwarded: '已获传家宝',
  investigatorDefeat: '阵亡调查员', sacrificedResident: '被献祭的居民',
  welcomeToHemlockValeIntro: '序曲引言分支', welcomeToHemlockValeChaosToken: '序曲混乱标记',
  welcomeToHemlockValeResolution: '序曲结局', welcomeToHemlockValeResolutionReason: '序曲结局原因',
  welcomeToHemlockValeBonusXp: '序曲奖励经验', welcomeToHemlockValeSurveyChoices: '序曲勘察选择',
  welcomeToHemlockValeTheBrilliance: '序曲的光辉',
  hemlockDatePlaceholder: '日期',
})

function printLabel (key) {
  const paths = []
  if (NOTE_LABEL_PATHS[key]) paths.push(NOTE_LABEL_PATHS[key])
  // Notes 集合本身的标签在 Campaign Log 的分节标题里（`key.sections.<notesKey>`）。
  if (key.endsWith('Notes')) paths.push(`key.sections.${key}`)
  paths.push(`key.${key}`)
  for (const path of paths) {
    const text = chapterText(LABEL_CHAPTER, path, 'zh') || chapterText(LABEL_CHAPTER, path, 'en')
    if (text) return htmlToText(text)
  }
  return ''
}

/** 指南正文是带 HTML 的 locale 文本；标签也要按同一口径转纯文本。 */
export function htmlToText (value) {
  return String(value ?? '')
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 记录键 → 中文/印刷标签（缺译回退内容层中文，不冒充官方中文）。 */
export function recordLabel (key) {
  return printLabel(key) || FALLBACK_LABELS[key] || humanize(key)
}

function humanize (key) {
  return String(key || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase())
}

export const FHV_RECORD_LABELS = Object.freeze(Object.fromEntries(
  Object.keys(FHV_RECORD_SCHEMA).map(key => [key, recordLabel(key)])))

export function recordDefaults () {
  return { ...FHV_RECORD_DEFAULTS }
}

/**
 * 记录键闭包检查：返回**未声明**的键（`content/schema.js#assertContentBundle` 会对章节
 * `recordReads/recordWrites` 逐键做同一检查）。内容层测试/注册期自检共用。
 */
export function missingRecordKeys (keys = [], schema = FHV_RECORD_SCHEMA) {
  return [...new Set(keys)].filter(key => !Object.hasOwn(schema, key)).sort()
}

/** 记录键 → 内容层类型（`record-map` 保留，不做引擎投影）。 */
export function recordTypeOf (key) {
  return FHV_RECORD_SCHEMA[key]?.type || null
}

// ---------------------------------------------------------------------------
// 5. 只读辅助（章节行为/尾声/测试共用）
// ---------------------------------------------------------------------------
/** 集合记录 → 数组（非数组一律空集；引擎 record-sets 口径）。 */
export function recordSet (records, key) {
  const value = records?.[key]
  return Array.isArray(value) ? [...value] : []
}

/** 已勘察区域（集合 ∪ 各章布尔键；去重、按 FHV_AREAS 顺序）。 */
export function surveyedAreas (records = {}) {
  const set = new Set(recordSet(records, 'areasSurveyed'))
  for (const area of FHV_AREAS) {
    for (const key of FHV_AREA_RECORD_KEYS[area.id] || []) if (records?.[key] === true) set.add(area.id)
  }
  return FHV_AREA_IDS.filter(id => set.has(id))
}

export function areaSurveyed (records, areaId) {
  return surveyedAreas(records).includes(areaId)
}

/** 区域记录键（章节行为写布尔值时用；未知区域返回空数组）。 */
export function areaRecordKeys (areaId) {
  return [...(FHV_AREA_RECORD_KEYS[areaId] || [])]
}

/** 关系等级（章节双写 `relationships[id]` 与 `<id>RelationshipLevel`/`<全名>Relationship`，取较大值）。 */
export function residentLevel (records = {}, residentId) {
  const row = FHV_RESIDENT_BY_ID[residentId]
  if (!row) return 0
  const aliases = FHV_RESIDENT_ALIASES[residentId]?.level || []
  const flat = Math.max(Number(records?.[row.record.level]) || 0,
    ...aliases.map(key => Number(records?.[key]) || 0))
  const map = Number(records?.relationships?.[residentId]
    ?? records?.residentRelationships?.[residentId]) || 0
  return Math.max(0, Math.min(FHV_RESIDENT_MAX_LEVEL, Math.max(flat, map)))
}

/** 居民是否被划掉（`<id>CrossedOut` / 别名 `<全名>CrossedOut` / 集合 `crossedOutResidents` 任一命中）。 */
export function residentCrossedOut (records = {}, residentId) {
  const row = FHV_RESIDENT_BY_ID[residentId]
  if (!row) return false
  const aliases = FHV_RESIDENT_ALIASES[residentId]?.crossedOut || []
  return records?.[row.record.crossedOut] === true
    || aliases.some(key => records?.[key] === true)
    || recordSet(records, 'crossedOutResidents').includes(residentId)
}

/**
 * 「印刷复选框已勾选」的判定：布尔 true，或**正数 tally**（`thePlanIsUnderway` 这类在引擎里按数字
 * 累加的键；印刷日志把它画成复选框）。
 */
function noteChecked (value) {
  return value === true || (typeof value === 'number' && value > 0)
}

/**
 * 居民笔记（`<id>Notes` 集合；章节也写同名布尔复选框/数字 tally，两者合并为「已记录」判定）。
 * 印刷日志把 `*CrossedOut` 也画在 Notes 分节里：它单独由 `residentCrossedOut` 表达，
 * 这里从笔记列表里排除，避免法典分支条件把它当成一条笔记。
 */
export function residentNotes (records = {}, residentId) {
  const row = FHV_RESIDENT_BY_ID[residentId]
  if (!row) return []
  const set = new Set(recordSet(records, row.record.notes))
  for (const key of FHV_RESIDENT_NOTES[residentId] || []) {
    if (key === row.record.crossedOut) continue
    if (noteChecked(records?.[key])) set.add(key)
  }
  set.delete(row.record.crossedOut)
  return [...set]
}

export function residentHasNote (records, residentId, noteKey) {
  return residentNotes(records, residentId).includes(noteKey)
}

/** 战役记录面板快照（大厅/尾声/审计读取；纯只读）。 */
export function recordsSnapshot (records = {}) {
  return Object.freeze({
    day: Number(records.day) || 0,
    time: String(records.time || ''),
    date: String(records.hemlockDate || ''),
    areasSurveyed: surveyedAreas(records),
    residents: Object.fromEntries(FHV_RESIDENTS.map(row => [row.id, Object.freeze({
      level: residentLevel(records, row.id),
      crossedOut: residentCrossedOut(records, row.id),
      notes: residentNotes(records, row.id),
    })])),
    codexRead: recordSet(records, 'codexRead').sort(),
    heirlooms: recordSet(records, 'heirloomsAwarded').sort(),
    unspentXp: Number(records.unspentXp) || 0,
    outcome: String(records.campaignOutcome || ''),
  })
}
