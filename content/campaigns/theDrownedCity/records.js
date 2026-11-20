// 《沉没之城》（The Drowned City）· 战役记录键 / 类型 / 默认值 / 标签（P7）。
//
// 事实源（锁定，只读）：
//   · 参考实现 `Campaigns/TheDrownedCity/Key.hs`（`TheDrownedCityKey` 全枚举）；
//   · `Campaigns/TheDrownedCity/Helpers.hs#artifactAssets` / `#rlyehArtifacts` / `#tasks`
//     （文物 6 张、R'lyeh 文物 5 张、任务 8 条）；
//   · 英文指南 `frontend/src/locales/en/theDrownedCity/base.json#key`（Campaign Log 印刷标签逐键一条）；
//   · CONTRACT §4 规范键表（P7 只允许这些键；新增键必须由 Lead 统一加）。
//
// 三层视图（与 FHV/TSK 的 records.js 同一分工）：
//   1. `TDC_RECORD_SCHEMA`：内容层 `{ key: { type, default } }`（类型只允许 boolean/number/string/string[]）；
//   2. `TDC_RECORD_TYPES` / `TDC_RECORD_DEFAULTS`：manifest / 引擎需要的两个投影；
//   3. `TDC_RECORD_LABELS`：Campaign Log 标签（story-text `campaign::key.<recordKey>`，
//      缺译回退内容层中文兜底，不冒充官方中文）。
//
// 本文件不写 state、不注册效果、不 import 引擎；只提供可序列化数据与只读辅助。
import { htmlToText, tdcStoryText } from './shared.js'

export const TDC_CAMPAIGN_ID = 'theDrownedCity'

// ---------------------------------------------------------------------------
// 1. CONTRACT §4 规范键表（44 键；字符串集合 3 个，其余布尔）
// ---------------------------------------------------------------------------
// 顺序与 CONTRACT 一致，便于逐条核对；分类注释给出印刷日志分节。
export const TDC_RECORD_KEYS = Object.freeze([
  // One Last Job
  'rubyWonTheBet', 'rubyLostTheBet', 'theInvestigatorsDiscoveredAnAlienLanguage',
  // Expedition to R'lyeh
  'theExpeditionHeadedWest', 'theExpeditionHeadedEast',
  'theDrownedQuarterWasSkipped',
  'theExpeditionHelpedThePilgrim', 'theExpeditionLeftThePilgrim',
  // The Inescapable
  'theCreatureWasDefeated',
  // Artifacts Earned
  'barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask', 'horrorInClay',
  // The Apiary / The Drowned Quarter / The Grand Vault
  'thePilgrimsWereSaved', 'thePilgrimsWereDevoured', 'theInvestigatorsExterminatedTheAlienParasites',
  'thePowerWasDiverted', 'theInnerSanctumWasUnsealed',
  // Obsidian Canyons
  'helpedWithTheRopes', 'wasHelpedWithTheRopes',
  // Glyph record / Expedition map / The Awakening / Return to Arkham
  'discoveredGlyphs', 'rlyehMap', 'yourAlliesHaveAPlan', 'theInvestigatorsStoodTogether',
  // Task completion records（Return to Arkham，每人一条）
  'isStrongInTheirFaith', 'madeBank', 'understandsTheFuture', 'foundTheirTrueHome',
  'sworeAnOathToProtectOthers', 'foundNewWork', 'pulledTheirWeight', 'learnedTheSecretTruth',
  'lostTheirFaith',
  // Sepulchre of the Sleeper
  'theInvestigatorsDidNotConfrontTheNightmare', 'theInvestigatorsHaltedCthulhusAwakening',
  // The Doom of Arkham
  'floodedNeighborhoods',
  'cthulhuWasDrivenAway', 'cthulhuAnnihilatedTheExpedition', 'cthulhuAnnihilatedTheCityOfArkham',
  'cthulhuWasBanished', 'arkhamWasDestroyed',
])

// 集合记录（string[]）：字形页 / R'lyeh 地图 / 被淹没街区（地图卡号列表）。
export const TDC_SET_RECORD_KEYS = Object.freeze([
  'discoveredGlyphs', 'rlyehMap', 'floodedNeighborhoods',
])

const RECORD_TYPES = Object.freeze(Object.fromEntries(
  TDC_RECORD_KEYS.map(key => [key, TDC_SET_RECORD_KEYS.includes(key) ? 'string[]' : 'boolean'])))

export const TDC_RECORD_TYPES = RECORD_TYPES

const defaultFor = type => (type === 'boolean' ? false
  : type === 'string[]' ? Object.freeze([])
    : type === 'number' ? 0
      : '')

export const TDC_RECORD_DEFAULTS = Object.freeze(Object.fromEntries(
  TDC_RECORD_KEYS.map(key => [key, defaultFor(RECORD_TYPES[key])])))

export const TDC_RECORD_SCHEMA = Object.freeze(Object.fromEntries(
  TDC_RECORD_KEYS.map(key => [key, Object.freeze({ type: RECORD_TYPES[key], default: TDC_RECORD_DEFAULTS[key] })])))

// ---------------------------------------------------------------------------
// 2. 关键子集（流程条件 / 幕间处理器共用）
// ---------------------------------------------------------------------------
// "Artifacts Earned" 的 6 张文物；`rlyehArtifacts` 是 Sepulchre 判定用的 5 张
// （Horror in Clay 只在《阿卡姆的毁灭》里获得，不计入"5 件文物"检查）。
export const TDC_ARTIFACT_RECORD_KEYS = Object.freeze([
  'barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask', 'horrorInClay',
])
export const TDC_RLYEH_ARTIFACT_RECORD_KEYS = Object.freeze([
  'barrierNode', 'obsidianClaw', 'shardOfYchlecht', 'tidalTablet', 'grislyMask',
])
// R'lyeh 地图上印的 7 个场景（base.json#rlyehMap 的键；开局全登记，完成时划除）。
export const TDC_RLYEH_MAP_IDS = Object.freeze([
  'rlyehWesternWall', 'rlyehDrownedQuarter', 'rlyehApiary', 'rlyehGrandVault',
  'rlyehCourtOfTheAncients', 'rlyehObsidianCanyons', 'rlyehSepulchreOfTheSleeper',
])
// 字形总数（A–Z，26 个；Sepulchre 门的门槛 10 / 26）。
export const TDC_GLYPH_LETTERS = Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
export const TDC_GLYPH_GATE = Object.freeze({ basic: 10, full: 26 })

// 8 条任务（Key.hs 的 Tasks 枚举 + Helpers.hs#tasks 的顺序/卡号/完成记录）。
// `card` = 未完成面（a），`completedCard` = 完成面（b），`completedRecord` = 完成时记入的 §4 键。
export const TDC_TASKS = Object.freeze([
  Object.freeze({ id: 'walkInFaith', card: '11754a', completedCard: '11754b', completedRecord: 'isStrongInTheirFaith', labelKey: 'anOfferYouCantRefuse.label.walkInFaith', titleKey: 'anOfferYouCantRefuse.task.walkInFaith.title', name: '信仰之行' }),
  Object.freeze({ id: 'toeTheLine', card: '11755a', completedCard: '11755b', completedRecord: 'foundNewWork', labelKey: 'anOfferYouCantRefuse.label.toeTheLine', titleKey: 'anOfferYouCantRefuse.task.toeTheLine.title', name: '坚守底线' }),
  Object.freeze({ id: 'noPlaceLikeHome', card: '11753a', completedCard: '11753b', completedRecord: 'foundTheirTrueHome', labelKey: 'anOfferYouCantRefuse.label.noPlaceLikeHome', titleKey: 'anOfferYouCantRefuse.task.noPlaceLikeHome.title', name: '没有比家更好的地方' }),
  Object.freeze({ id: 'goodMoney', card: '11756a', completedCard: '11756b', completedRecord: 'madeBank', labelKey: 'anOfferYouCantRefuse.label.goodMoney', titleKey: 'anOfferYouCantRefuse.task.goodMoney.title', name: '好钱' }),
  Object.freeze({ id: 'doNoHarm', card: '11758a', completedCard: '11758b', completedRecord: 'sworeAnOathToProtectOthers', labelKey: 'anOfferYouCantRefuse.label.doNoHarm', titleKey: 'anOfferYouCantRefuse.task.doNoHarm.title', name: '不伤害他人' }),
  Object.freeze({ id: 'proveYourWorth', card: '11757a', completedCard: '11757b', completedRecord: 'pulledTheirWeight', labelKey: 'anOfferYouCantRefuse.label.proveYourWorth', titleKey: 'anOfferYouCantRefuse.task.proveYourWorth.title', name: '证明你的价值' }),
  Object.freeze({ id: 'dreamsOfDestruction', card: '11759a', completedCard: '11759b', completedRecord: 'understandsTheFuture', labelKey: 'anOfferYouCantRefuse.label.dreamsOfDestruction', titleKey: 'anOfferYouCantRefuse.task.dreamsOfDestruction.title', name: '毁灭之梦' }),
  Object.freeze({ id: 'plumbTheDepths', card: '11760a', completedCard: '11760b', completedRecord: 'learnedTheSecretTruth', labelKey: 'anOfferYouCantRefuse.label.plumbTheDepths', titleKey: 'anOfferYouCantRefuse.task.plumbTheDepths.title', name: '探究深渊' }),
])

export const TDC_TASK_IDS = Object.freeze(TDC_TASKS.map(task => task.id))
export const TDC_TASK_BY_ID = Object.freeze(Object.fromEntries(TDC_TASKS.map(task => [task.id, task])))
export const TDC_TASK_BY_CARD = Object.freeze(Object.fromEntries(
  TDC_TASKS.flatMap(task => [[task.card, task], [task.completedCard, task]])))
export const TDC_TASK_COMPLETED_RECORDS = Object.freeze(
  TDC_TASKS.map(task => task.completedRecord))
// 任务进度门限：达到 5 即完成（参考 Helpers.hs#ReturnToArkham）。
export const TDC_TASK_COMPLETION_PROGRESS = 5
// 任务进度用引擎 P7 原语 `campaign.progressTracks`，轨道名与 `src/engine/tdc-interactions.js` 同源。
export const TDC_TASK_TRACK = 'tdcTask'

// 远征剧情资产（Interlude II：西线带 Andy、东线带 Ruby）。
export const TDC_EXPEDITION_STORY_ASSETS = Object.freeze({
  andyVanNortwick: '11766',
  rubyStandish: '11765',
})

// ---------------------------------------------------------------------------
// 3. 只读辅助
// ---------------------------------------------------------------------------
/** 记录键 → 类型（boolean / string[]）。 */
export function recordTypeOf (key) {
  return RECORD_TYPES[key] || null
}

/** 集合记录 → 数组（非数组一律空集；引擎 record-sets 口径）。 */
export function recordSet (records, key) {
  const value = records?.[key]
  return Array.isArray(value) ? [...value] : []
}

/** 记录键闭包检查：返回**未声明**的键（注册期/测试共用）。 */
export function missingRecordKeys (keys = []) {
  return [...new Set(keys)].filter(key => !Object.hasOwn(RECORD_TYPES, key)).sort()
}

export function recordDefaults () {
  return { ...TDC_RECORD_DEFAULTS }
}

/** 已获得的 R'lyeh 文物（顺序 = TDC_RLYEH_ARTIFACT_RECORD_KEYS）。 */
export function earnedRlyehArtifacts (records = {}) {
  return TDC_RLYEH_ARTIFACT_RECORD_KEYS.filter(key => records?.[key] === true)
}

/** 已获得的全部文物（含 Horror in Clay）。 */
export function earnedArtifacts (records = {}) {
  return TDC_ARTIFACT_RECORD_KEYS.filter(key => records?.[key] === true)
}

/** 已翻译字形数（去重后的非空大写字母；与参考 `getTranslatedGlyphCount` 同口径）。 */
export function translatedGlyphCount (records = {}) {
  const letters = new Set(recordSet(records, 'discoveredGlyphs')
    .filter(value => typeof value === 'string' && value.length > 0)
    .map(value => value.toUpperCase()))
  return letters.size
}

/** R'lyeh 地图上尚未划除的场景 id。 */
export function remainingRlyehMap (records = {}) {
  const crossed = new Set(recordSet(records, 'rlyehMap'))
  return TDC_RLYEH_MAP_IDS.filter(id => !crossed.has(id))
}

// ---------------------------------------------------------------------------
// 4. 标签（Campaign Log 印刷标签 + 内容层中文兜底）
// ---------------------------------------------------------------------------
// 印刷标签路径：平铺 `campaign::key.<recordKey>`（base.json#key）。
const FALLBACK_LABELS = Object.freeze({
  rubyWonTheBet: '露比赢了赌局',
  rubyLostTheBet: '露比输了赌局',
  theInvestigatorsDiscoveredAnAlienLanguage: '调查员发现了外星语言',
  theExpeditionHeadedWest: '远征队向西前进',
  theDrownedQuarterWasSkipped: '远征队绕过了淹没城区',
  theExpeditionHeadedEast: '远征队向东前进',
  theExpeditionHelpedThePilgrim: '远征队帮助了朝圣者',
  theExpeditionLeftThePilgrim: '远征队抛下了朝圣者',
  theCreatureWasDefeated: '那生物被击败了',
  barrierNode: '屏障节点',
  obsidianClaw: '黑曜石爪',
  shardOfYchlecht: '伊赫莱赫特碎片',
  tidalTablet: '潮汐石板',
  grislyMask: '可怖面具',
  horrorInClay: '陶土恐怖',
  thePilgrimsWereSaved: '朝圣者获救',
  thePilgrimsWereDevoured: '朝圣者被吞噬',
  theInvestigatorsExterminatedTheAlienParasites: '调查员清除了外星寄生物',
  thePowerWasDiverted: '能量被分流',
  theInnerSanctumWasUnsealed: '内殿被解封',
  helpedWithTheRopes: '曾协助拉绳',
  wasHelpedWithTheRopes: '曾被协助拉绳',
  discoveredGlyphs: '已翻译的异星字形',
  rlyehMap: '拉莱耶地图',
  yourAlliesHaveAPlan: '你的盟友自有计划',
  theInvestigatorsStoodTogether: '调查员并肩而立',
  isStrongInTheirFaith: '信仰坚定',
  madeBank: '赚得盆满钵满',
  understandsTheFuture: '看见了未来',
  foundTheirTrueHome: '找到了真正的家',
  sworeAnOathToProtectOthers: '立誓保护他人',
  foundNewWork: '找到了新工作',
  pulledTheirWeight: '尽到了本分',
  learnedTheSecretTruth: '得知了秘密真相',
  lostTheirFaith: '失去了信仰',
  theInvestigatorsDidNotConfrontTheNightmare: '调查员没有直面梦魇',
  theInvestigatorsHaltedCthulhusAwakening: '调查员阻止了克苏鲁苏醒',
  floodedNeighborhoods: '被淹没的街区',
  cthulhuWasDrivenAway: '克苏鲁被驱离',
  cthulhuAnnihilatedTheExpedition: '克苏鲁歼灭了远征队',
  cthulhuAnnihilatedTheCityOfArkham: '克苏鲁毁灭了阿卡姆城',
  cthulhuWasBanished: '克苏鲁被放逐',
  arkhamWasDestroyed: '阿卡姆被摧毁',
})

function humanize (key) {
  return String(key || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase())
}

/** 记录键 → 中文/印刷标签（缺译回退内容层中文，不冒充官方中文）。 */
export function recordLabel (key) {
  const printed = htmlToText(tdcStoryText(`key.${key}`))
  return printed || FALLBACK_LABELS[key] || humanize(key)
}

export const TDC_RECORD_LABELS = Object.freeze(Object.fromEntries(
  TDC_RECORD_KEYS.map(key => [key, recordLabel(key)])))

/** 战役记录面板快照（大厅/尾声/审计读取；纯只读）。 */
export function recordsSnapshot (records = {}) {
  return Object.freeze({
    artifacts: earnedArtifacts(records),
    rlyehArtifacts: earnedRlyehArtifacts(records),
    glyphs: recordSet(records, 'discoveredGlyphs').sort(),
    glyphCount: translatedGlyphCount(records),
    rlyehMap: recordSet(records, 'rlyehMap').sort(),
    floodedNeighborhoods: recordSet(records, 'floodedNeighborhoods').sort(),
    route: records?.theExpeditionHeadedWest === true ? 'west'
      : records?.theExpeditionHeadedEast === true ? 'east' : null,
    ended: {
      cthulhuWasDrivenAway: records?.cthulhuWasDrivenAway === true,
      cthulhuWasBanished: records?.cthulhuWasBanished === true,
      cthulhuAnnihilatedTheExpedition: records?.cthulhuAnnihilatedTheExpedition === true,
      cthulhuAnnihilatedTheCityOfArkham: records?.cthulhuAnnihilatedTheCityOfArkham === true,
      arkhamWasDestroyed: records?.arkhamWasDestroyed === true,
      theInvestigatorsHaltedCthulhusAwakening: records?.theInvestigatorsHaltedCthulhusAwakening === true,
    },
  })
}
