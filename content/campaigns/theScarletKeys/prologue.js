// 《绯红密钥》（The Scarlet Keys）· 序幕（P7）。
//
// 事实源（锁定）：
//   · 参考实现 `Arkham/Campaign/Campaigns/TheScarletKeys.hs#CampaignStep PrologueStep`：
//     读 `prologue.title/body`（《秘密战争》），随后 `initMeta` 建立世界地图（当前位置 London、
//     21 个初始解锁节点 + 5 个绿地、时间 0）；
//   · `Campaigns/TheScarletKeys/Helpers.hs#setupKeys` / `#campaignChaosBag` / `#handleRedCoterie`：
//     绯红密钥容器、四档混乱袋（shared.js#CHAOS_BAGS 由清单声明）、红色同志会三池；
//   · `Campaigns/TheScarletKeys/Helpers.hs#markTime` 的固定阈值表（shared.js#STATUS_REPORTS）；
//   · 正文键：`prologue`（秘密战争）、`specialRules`（六条战役特别规则）；标题走
//     `headings.prologue`（战役准备）与 `prologue.title`（秘密战争）。
//
// P7 口径：
//   · 序幕节点只存 `textKey`，正文由 parts.js#campaignStoryText 从 story-text 读取；
//   · `campaignStart` 是幂等的「战役开局初始化」处理器：地图/状况报告/密钥/同志会/时间记录，
//     旧存档或非战役开局不会因为再次进入序幕而重复初始化；
//   · 序幕不做「真相/隐瞒」选择——那是幕间 I（interlude1）的分支，R&R 章节通过
//     `tskPrologueIntent` 读取同一结果（见 interludes.js#interlude1）。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { initializeCoterie } from '../../../src/engine/tsk-coterie.js'
import {
  initializeStatusReports, initializeWorldMap, mapTime, worldMapState,
} from '../../../src/engine/tsk-map.js'
import { initializeScarletKeys, scarletKeys } from '../../../src/engine/tsk-scarlet-keys.js'
import { INVALID_CAMPAIGN_CARDS, KEY_CARDS, STATUS_REPORTS } from './shared.js'
import {
  TSK_FORCED_ENDGAME_TIME, TSK_INITIAL_UNLOCKED, TSK_SCENARIO_IDS, TSK_START_LOCATION,
  TSK_WORLD_MAP, TSK_ENDGAME_MAP_NODE, campaignStoryHeading, campaignStoryText,
} from './parts.js'

export const PROLOGUE_HANDLER_ID = 'scarletKeysPrologue'

// 红色同志会十名核心成员（`red_coterie` 遭遇组 09752–09761）。开局全部在「恩怨未了」池：
// 时间 10 之后每关设置按 Helpers.hs#handleRedCoterie 随机抽 1 名洗入遭遇牌库（P8 接线）。
export const COTERIE_CORE_CODES = Object.freeze([
  '09752', '09753', '09754', '09755', '09756', '09757', '09758', '09759', '09760', '09761',
])

// 绯红密钥初始化清单（shared.js#KEY_CARDS：物理卡号 + 稳定面/动荡面）。
// 引擎不认卡号，只认内容层给的面标识；持有者缺省 none（章节/幕间按剧情 bindKey）。
// 引擎的密钥定义只允许 id/stableFace/unstableFace/bearer 四个字段（tsk-scarlet-keys.js），
// 章节归属留在 KEY_CARDS/parts.js 的身份表里，不塞进引擎载荷。
export const KEY_INIT_SPECS = Object.freeze(KEY_CARDS.map(key => Object.freeze({
  id: key.id,
  stableFace: key.stableCode,
  unstableFace: key.unstableCode,
})))

// 序幕节点的本地文本兜底（生成物缺键时只作为空正文的防御，不含剧情）。
const text = path => campaignStoryText(path)
const heading = (path, fallback) => campaignStoryHeading(path) || fallback

// ---------------------------------------------------------------------------
// 序幕子图：prologue（秘密战争）→ prologueRules（战役准备/特别规则）→ 谜雨
// ---------------------------------------------------------------------------
export const PROLOGUE_NODES = Object.freeze({
  prologue: {
    type: 'story',
    title: heading('prologue', '序幕'),
    textKey: 'prologue',
    text: text('prologue'),
    // 战役开始的第一批初始化：世界地图/状况报告阈值/十把密钥/同志会三池/流程记录。
    effects: [{ type: 'registered', handler: PROLOGUE_HANDLER_ID, event: 'campaignStart' }],
    next: 'prologueRules',
  },
  prologueRules: {
    type: 'story',
    title: heading('headings.prologue', '战役准备'),
    textKey: 'specialRules',
    text: text('specialRules'),
    next: 'riddlesAndRain',
  },
})

export const PROLOGUE_TEXT_KEYS = Object.freeze(['prologue', 'specialRules'])

// ---------------------------------------------------------------------------
// 战役开局初始化
// ---------------------------------------------------------------------------
const logLine = (log, line) => { if (typeof log === 'function') log(line) }

/** 幂等：容器已存在时吞掉「已经初始化」错误（旧存档/章节先行初始化的情形）。 */
function once (log, label, run) {
  try {
    return run()
  } catch (error) {
    if (/已经初始化/.test(String(error?.message || ''))) return null
    logLine(log, `⚠️ ${label}初始化失败：${error.message}`)
    return null
  }
}

function ensureCampaignShape (state) {
  const campaign = state?.campaign
  if (!campaign) return null
  campaign.records ||= {}
  return campaign
}

/**
 * 战役开局初始化（幂等）。
 * 返回一份可测试的快照：地图/状况报告阈值/密钥数/同志会池/时间。
 */
export function startScarletKeysCampaign (state, log) {
  const campaign = ensureCampaignShape(state)
  if (!campaign) return null
  const records = campaign.records

  // 1) 世界地图：当前位置 London、初始解锁 21 + 5 绿地、强制目的地 Tunguska（时间满 35）。
  once(log, '世界地图', () => initializeWorldMap(state, {
    graph: { nodes: TSK_WORLD_MAP },
    start: TSK_START_LOCATION,
    unlocked: [...TSK_INITIAL_UNLOCKED],
    forcedNode: TSK_ENDGAME_MAP_NODE,
  }))
  // 2) 状况报告阈值（α 7 / ε 10 / β 15 / ζ 20 / γ 24 / ω 35；θ、ψ 由剧情写入）。
  once(log, '状况报告', () => initializeStatusReports(state, { thresholds: STATUS_REPORTS }))
  // 3) 十把双面绯红密钥（稳定面/动荡面；开局无人持有）。
  once(log, '绯红密钥', () => initializeScarletKeys(state, KEY_INIT_SPECS))
  // 4) 红色同志会三池（十名核心成员全部「恩怨未了」）。
  once(log, '红色同志会', () => initializeCoterie(state, {
    members: { unresolved: [...COTERIE_CORE_CODES], ally: [], defeated: [] },
  }))

  // 4.5) 战役禁用卡：02310《戴红手套的男子》等整场战役禁入牌组。
  // 读点：构筑/升级过滤在 campaign.js#replacementAnalysis（context.invalidCards），
  // 存在抹除名单另由 tsk-hollow#invalidCampaignCards 合并。
  once(log, '禁用卡', () => {
    campaign.tsk ||= { version: 1 }
    campaign.tsk.invalidCards = [...new Set([...(campaign.tsk.invalidCards || []), ...INVALID_CAMPAIGN_CARDS])]
  })

  // 5) 流程记录（跨章持久；与 recordSchema 一致，不新造未声明字段）。
  const map = worldMapState(state)
  records.time = map?.time ?? mapTime(state) ?? 0
  records.currentLocation = map?.current ?? TSK_START_LOCATION
  records.mapVisitedLocations = [...(map?.visited || [TSK_START_LOCATION])]
  records.scenarioOrder = [...TSK_SCENARIO_IDS]
  records.chaptersCompleted = Array.isArray(records.chaptersCompleted) ? records.chaptersCompleted : []
  records.wrongLeadCount = 0
  records.rusesFound = false
  records.deltaTime = 0
  records.psiTime = 0
  records.deltaDeadline = 0
  records.psiDeadline = 0
  records.thetaTime = 0
  records.foundationTrust = 0
  records.cellDeception = 0
  records.foundationIntelDelivered = false
  records.campaignOutcome = ''
  records.statusReportsSeen = []
  records.interludeVisits = []
  records.keysStolen = []
  records.keysHeld = Array.isArray(records.keysHeld) ? records.keysHeld : []
  records.erasedCards = Array.isArray(records.erasedCards) ? records.erasedCards : []
  records.expeditedTickets = Number(records.expeditedTickets) || 0
  if (Object.hasOwn(campaign.recordSchema || {}, 'tskTime')) records.tskTime = records.time

  const snapshot = {
    time: records.time,
    location: records.currentLocation,
    unlocked: [...(map?.unlocked || [])],
    keys: scarletKeys(state).length,
    coterie: COTERIE_CORE_CODES.length,
    forcedAt: TSK_FORCED_ENDGAME_TIME,
  }
  logLine(log, `🎬 《绯红密钥》战役准备完成：当前位于 ${snapshot.location}，时间 ${snapshot.time}；`
    + `地图解锁 ${snapshot.unlocked.length} 个节点；${snapshot.keys} 把绯红密钥、`
    + `${snapshot.coterie} 名红色同志会成员进入「恩怨未了」池；时间达到 ${TSK_FORCED_ENDGAME_TIME} 时强制前往通古斯卡。`)
  return snapshot
}

export function runPrologueEffect (state, effect, log) {
  if (effect.event === 'campaignStart') return startScarletKeysCampaign(state, log)
  throw new Error(`未知序幕效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(PROLOGUE_HANDLER_ID, runPrologueEffect)
