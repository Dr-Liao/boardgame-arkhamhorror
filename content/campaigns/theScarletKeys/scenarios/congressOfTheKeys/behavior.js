// 钥匙议会（Congress of the Keys · 09694 · 通古斯卡）· 引擎钩子（章节流程 + 审判/异界/密钥机械）。
//
// 约定（与其它 TSK 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 enemyRule / assetRule / keyShift 里；本章专属组只有拟态克星一张非地点卡，
//     其余遭遇卡来自共享组（由共享组条目自行结算）；
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api；
//   · 隐匿迷你卡统一走 P2 原语 `src/engine/tsk-concealed.js`；绯红密钥走
//     `api.mechanics.tsk.keys`（`src/engine/tsk-scarlet-keys.js`）；空洞/存在抹除走 `tsk-hollow.js`。
//
// 本章机械（参考 `Scenarios/TheScarletKeys/CongressOfTheKeys.hs`）：
//   1. 审判：11 位同志会成员按剧本日志逐段投票（增量计票，赞成 ≥ 反对 → 有罪），
//      结论决定设置版本：v.I（逃离）/ v.II（主动出发或颠覆/加入/被当作资产）/ v.III（同志会内乱）。
//   2. 密钥归属：被「跳过」的章节对应的六把绯红密钥判给同志会成员（敌人持钥时只结算效果不翻回稳定面）。
//   3. 异界终局：幕 1 背面把场上地点移出游戏，改放三张高塔；残骸之城迷你卡按左/中/右摆放，
//      环绕悖逆重力之阶的迷你卡必须按 左 → 中 → 右 揭露才能进入睥睨众生之巅。
//   4. 结局：1「域外来客遭到阻止」（+5 奖励经验、2/2 创伤）；2「特别小组成为空洞」（战役失败，
//      空洞卡写入存在抹除名单）。
import { exposeWithReaction } from '../../concealed.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { isPendingChoice } from '../../../../../src/engine/resolution.js'
import {
  concealedMiniCards, distributeConcealed, exposeMiniCard, setInShadows,
} from '../../../../../src/engine/tsk-concealed.js'
import { hollowCards } from '../../../../../src/engine/tsk-hollow.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { registerModifierProvider } from '../../../../../src/engine/modifiers.js'
import {
  ACT1_VERSIONS, AGENDA1, AGENDA2, AGENDA3, CHAPTER_ID, CITY_OF_REMNANTS_KINDS, CONCEALED_KINDS,
  CONCEALED_PER_INVESTIGATOR, CONGRESS_KEYS, COTERIE_ENEMY_CODES, COTERIE_MEMBERS, DECOY_KIND,
  GATHER_GROUPS, KEY_BY_ID, LOCATIONS, LOCATION_RULES, MEMBER_BY_ID, OTHERWORLD_LOCATION_CODES,
  RAW_CODES, RECORD_READS, RECORD_WRITES, RED_GLOVED_MAN, RESOLUTION1_BONUS_XP, RESOLUTION1_TRAUMA,
  SCENARIO_TEXT, SECOND_ENCOUNTER_DECK, SET_ASIDE_CODES, SET_ASIDE_LOCATION_CODES, SHADOW_POSITIONS,
  START_LOCATION_BY_VERSION, TOWER_LOCATION_IDS, TRIAL_OUTCOME_RECORDS, cardNameOf, clueValueOf,
  encounterDeckForVersion, resolutions,
} from './definition.js'
import { CONGRESS_TOKEN_MEANINGS, congressAfterTest, congressChaosToken } from './chaos.js'

const STATE_KEY = CHAPTER_ID
const STATE_VERSION = 1
const MAX_TRIAL_STEPS = 12

// ---------------------------------------------------------------------------
// 小工具（内容层专用；卡条目不得使用）
// ---------------------------------------------------------------------------
const codeOf = card => card?.originalCode || card?.code || card || null
const clone = value => JSON.parse(JSON.stringify(value))
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const investigatorCount = state => Math.max(1, Number(state.numInvestigators) || (state.investigators || []).length || 1)
const leadSeat = state => Number(state.campaign?.leadSeat ?? state.investigators?.[0]?.seat ?? 0)
const locationName = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || String(id || '')
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const flagsOf = state => (state.scenarioFlags ||= {})
const zonesOf = state => (state.scenarioZones ||= {})
const shuffleWith = (state, list, helper = {}) => {
  if (typeof helper.shuffle === 'function') return helper.shuffle([...list], () => helper.randomValue(state))
  const copy = [...list]
  const random = typeof helper.randomValue === 'function' ? () => helper.randomValue(state)
    : () => randomValue(state)
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const choiceFor = (api, request) => {
  const choose = api?.choose || api?.choice
  if (typeof choose !== 'function') return null
  try {
    return choose(request)
  } catch (error) {
    // 引擎用异常表达「等待玩家选择 / 事务检查点」；吞掉会让选择静默默认或事务游标失配。
    if (isPendingChoice(error)) throw error
    return null
  }
}
const infoOf = (api, text) => api?.info?.(text)

// ---------------------------------------------------------------------------
// 章节状态（纯 JSON；随存档往返）
// ---------------------------------------------------------------------------
export function chapterState(state) {
  const flags = (state.scenarioFlags ||= {})
  const data = flags[STATE_KEY] ||= {}
  data.version ||= STATE_VERSION
  if (data.introResolved == null) data.introResolved = false
  if (data.version3 == null) data.version3 = false
  if (!Array.isArray(data.otherworldDeck)) data.otherworldDeck = []
  if (!Array.isArray(data.shadowLocations)) data.shadowLocations = []
  if (!Array.isArray(data.citySequence)) data.citySequence = []
  if (!Array.isArray(data.vertexSequence)) data.vertexSequence = []
  if (!Array.isArray(data.exposedDecoys)) data.exposedDecoys = []
  if (!Array.isArray(data.confidants)) data.confidants = []
  if (!Array.isArray(data.pendingKeyAwards)) data.pendingKeyAwards = []
  if (!Array.isArray(data.awardedKeys)) data.awardedKeys = []
  if (!Array.isArray(data.erasedHollows)) data.erasedHollows = []
  if (data.vertexUnlocked == null) data.vertexUnlocked = false
  if (data.encounterDeckSwitched == null) data.encounterDeckSwitched = false
  if (data.hollowedCommitted == null) data.hollowedCommitted = false
  if (data.doomOnNextAgenda == null) data.doomOnNextAgenda = 0
  if (data.climbCluesPaid == null) data.climbCluesPaid = false
  return data
}

export const voteTable = state => ({ ...(state?.scenarioFlags?.[STATE_KEY]?.votes || {}) })
export const trialOutcome = state => state?.scenarioFlags?.[STATE_KEY]?.outcome || null
export const setupVersion = state => Number(state?.scenarioFlags?.[STATE_KEY]?.setupVersion) || 1
export const otherworldDeckOf = state => [...(chapterState(state).otherworldDeck || [])]
export const shadowLocationsOf = state => (chapterState(state).shadowLocations || []).map(entry => ({ ...entry }))
export const vertexUnlocked = state => chapterState(state).vertexUnlocked === true

// ---------------------------------------------------------------------------
// 战役记录读点（审判的输入）
// ---------------------------------------------------------------------------
export function hasRecord(state, key) {
  const value = recordsFor(state)[key]
  return value === true || value === 'true'
}
export function recordFact(state, key, value = true) {
  const records = recordsFor(state)
  if (value === false) delete records[key]
  else records[key] = value
  return records[key]
}
/** 标记 n 时间（战役记录 time；世界地图已初始化时同步 campaign.tsk.map.time）。 */
export function markTime(state, amount = 0) {
  const step = Math.floor(Number(amount) || 0)
  if (step <= 0) return Number(recordsFor(state).time) || 0
  const records = recordsFor(state)
  records.time = (Number(records.time) || 0) + step
  const map = state.campaign?.tsk?.map
  if (map) map.time = Number(records.time)
  return records.time
}
/** 记录/移除「队伍持有某把绯红密钥」（keysHeld 字符串数组）。 */
export function setKeyHeld(state, keyId, held = true) {
  const records = recordsFor(state)
  const list = Array.isArray(records.keysHeld) ? [...records.keysHeld] : []
  const next = held ? [...new Set([...list, keyId])] : list.filter(id => id !== keyId)
  records.keysHeld = next
  return next
}
export function markChapterCompleted(state, chapterId = CHAPTER_ID) {
  const records = recordsFor(state)
  const list = Array.isArray(records.chaptersCompleted) ? [...records.chaptersCompleted] : []
  records.chaptersCompleted = [...new Set([...list, chapterId])]
  return records.chaptersCompleted
}

// ---------------------------------------------------------------------------
// 审判：投票（增量计票，与参考实现逐段一致）
// ---------------------------------------------------------------------------
/** 剧本日志 → 计票输入。desiIsGood/Bad 用德西相关记录近似（没有「德西卡面版本」存档字段）。 */
export function trialInputs(state) {
  const flag = key => hasRecord(state, key)
  const desiIsGood = (flag('desiIsInYourDebt') || flag('theCellMadeADealWithDesi'))
    && !flag('youHaventSeenTheLastOfDesiderioDelgadoAlvarez')
  const desiIsBad = flag('youHaventSeenTheLastOfDesiderioDelgadoAlvarez')
  return {
    theCellAidedTheKnight: flag('theCellAidedTheKnight'),
    theCellFailedToFendOffTheBeast: flag('theCellFailedToFendOffTheBeast'),
    youHaventSeenTheLastOfTheClaretKnight: flag('youHaventSeenTheLastOfTheClaretKnight'),
    theDogsAreAtWar: flag('theDogsAreAtWar'),
    eceTrustsTheCell: flag('eceTrustsTheCell'),
    eceDoesNotTrustTheCell: flag('eceDoesNotTrustTheCell'),
    youHaventSeenTheLastOfAmaranth: flag('youHaventSeenTheLastOfAmaranth'),
    theLoversAreReunited: flag('theLoversAreReunited'),
    amaranthHasLeftTheCoterie: flag('amaranthHasLeftTheCoterie'),
    youHaventSeenTheLastOfThorne: flag('youHaventSeenTheLastOfThorne'),
    theCellMadeADealWithThorne: flag('theCellMadeADealWithThorne'),
    thorneDisappeared: flag('thorneDisappeared'),
    alikiIsOnYourSide: flag('alikiIsOnYourSide'),
    youHaventSeenTheLastOfAlikiZoniUperetria: flag('youHaventSeenTheLastOfAlikiZoniUperetria'),
    youHaventSeenTheLastOfLaChicaRoja: flag('youHaventSeenTheLastOfLaChicaRoja'),
    youHaventSeenTheLastOfTheSanguineWatcher: flag('youHaventSeenTheLastOfTheSanguineWatcher'),
    theSanguineWatchersTormentContinues: flag('theSanguineWatchersTormentContinues'),
    youHaventSeenTheLastOfTzuSanNiang: flag('youHaventSeenTheLastOfTzuSanNiang'),
    tzuSanNiangHasYouUnderHerSway: flag('tzuSanNiangHasYouUnderHerSway'),
    tzuSanNiangIsUnderYourSway: flag('tzuSanNiangIsUnderYourSway'),
    tuwileMasaiIsOnYourSide: flag('tuwileMasaiIsOnYourSide'),
    youHaventSeenTheLastOfDesiderioDelgadoAlvarez: flag('youHaventSeenTheLastOfDesiderioDelgadoAlvarez'),
    theCellKnowsTheTrueNatureOfTheCoterie: flag('theCellKnowsTheTrueNatureOfTheCoterie'),
    theCellMeddledInAbarransAffairs: flag('theCellMeddledInAbarransAffairs'),
    desiIsGood, desiIsBad,
  }
}

/**
 * 一次完整审判：逐段累计赞成/反对（段号与参考实现 DoStep 1 的 nay1..finalNay 对齐），
 * 并给出每位成员最终的票型与结论。
 * 返回 `{ steps, tally, votes, rows, decision, options, record }`。
 */
export function computeTrial(input) {
  const t = input

  // ① 《战争疮痍》：暗红骑士 / 深红斗篷的恶兽
  const nay1 = (t.theCellFailedToFendOffTheBeast || t.youHaventSeenTheLastOfTheClaretKnight || t.theDogsAreAtWar) ? 0 : 1
  const yea1 = t.theCellAidedTheKnight ? 0
    : t.theCellFailedToFendOffTheBeast ? 1
      : t.youHaventSeenTheLastOfTheClaretKnight ? 2
        : t.theDogsAreAtWar ? 0 : 1
  const dogsOfWarSkipped = !(t.theCellAidedTheKnight || t.theCellFailedToFendOffTheBeast
    || t.youHaventSeenTheLastOfTheClaretKnight || t.theDogsAreAtWar)
  // ② 《暗中交易》：艾婕
  const nay2 = nay1 + (t.eceDoesNotTrustTheCell ? 0 : 1)
  const yea2 = yea1
  // ③ 《死亡酷暑》：苋（情人重聚算 2 票：苋与拉辛）
  const nay3 = nay2
  const yea3 = yea2 + (t.youHaventSeenTheLastOfAmaranth ? 1
    : t.theLoversAreReunited ? 2
      : t.amaranthHasLeftTheCoterie ? 0 : 1)
  // ④ 《如履薄冰》：索恩
  const nay4 = nay3 + (t.theCellMadeADealWithThorne ? 1 : 0)
  const yea4 = yea3 + (t.youHaventSeenTheLastOfThorne ? 1 : 0)
  // ⑤ 《不留痕迹》：艾里奇
  const nay5 = nay4 + (t.alikiIsOnYourSide ? 1 : 0)
  const yea5 = yea4 + (t.youHaventSeenTheLastOfAlikiZoniUperetria ? 0 : 1)
  // ⑥ 《疯星乱舞》：德西
  const skippedDancingMad = !(t.desiIsGood || t.desiIsBad || t.youHaventSeenTheLastOfDesiderioDelgadoAlvarez)
  const nay6 = nay5 + (t.desiIsGood ? 1 : 0)
  const yea6 = yea5 + (skippedDancingMad ? 1 : 0)
  // ⑦ 《财富与愚行》：阿巴冉
  const nay7 = nay6
  const yea7 = yea6 + (t.theCellMeddledInAbarransAffairs ? 1 : 0)
  // ⑧ 《血色阴影》：红衣女郎 / 血色监视者
  const laChicaRojaVotedNay = t.youHaventSeenTheLastOfTheSanguineWatcher || t.theSanguineWatchersTormentContinues
  const finishedEarly = t.theCellKnowsTheTrueNatureOfTheCoterie
    || (1 + [t.thorneDisappeared, t.youHaventSeenTheLastOfAlikiZoniUperetria,
      t.youHaventSeenTheLastOfDesiderioDelgadoAlvarez || t.desiIsBad].filter(Boolean).length >= 3)
  const nay8 = finishedEarly ? nay7 : nay7 + (laChicaRojaVotedNay ? 1 : 0)
  const yea8 = finishedEarly ? yea7 : yea7 + (t.youHaventSeenTheLastOfLaChicaRoja ? 1
    : t.youHaventSeenTheLastOfTheSanguineWatcher ? 1 : 0)
  // ⑨ 《苦痛之影》：朱三娘
  const nay9 = nay8
  const yea9 = finishedEarly ? yea8 : yea8 + (t.tzuSanNiangIsUnderYourSway ? 0 : 1)
  // ⑩ 特瓦耶·马萨伊（没有敌人卡，但有一票）
  const finalNay = nay9 + (t.tuwileMasaiIsOnYourSide ? 1 : 0)
  const finalYea = yea9 + (t.tuwileMasaiIsOnYourSide ? 0 : 1)

  const judgedLiable = finalYea >= finalNay
  const claretKnightVotedNay = t.theCellAidedTheKnight
    || !(t.theCellFailedToFendOffTheBeast || t.youHaventSeenTheLastOfTheClaretKnight || t.theDogsAreAtWar)
  const eceVotedNay = !t.eceDoesNotTrustTheCell
  const canOverthrow = laChicaRojaVotedNay && eceVotedNay && t.desiIsGood
  const canJoin = claretKnightVotedNay && t.tuwileMasaiIsOnYourSide && t.theCellMadeADealWithThorne
  const eerilySilent = !t.theCellKnowsTheTrueNatureOfTheCoterie && finishedEarly

  // 每位成员的最终票型（与参考实现的 votes 表逐项一致）。
  const votes = {
    redGlovedMan: 'eerilySilent',
    laChicaRoja: finishedEarly ? 'abstained'
      : t.youHaventSeenTheLastOfLaChicaRoja ? 'abstained'
        : laChicaRojaVotedNay ? 'nay' : 'abstained',
    sanguineWatcher: finishedEarly ? 'abstained'
      : (t.youHaventSeenTheLastOfLaChicaRoja || t.youHaventSeenTheLastOfTheSanguineWatcher) ? 'yea'
        : 'abstained',
    beast: t.theCellAidedTheKnight ? 'abstained'
      : (t.theCellFailedToFendOffTheBeast || t.youHaventSeenTheLastOfTheClaretKnight) ? 'yea'
        : t.theDogsAreAtWar ? 'abstained' : 'yea',
    claretKnight: t.theCellAidedTheKnight ? 'nay'
      : t.theCellFailedToFendOffTheBeast ? 'abstained'
        : t.youHaventSeenTheLastOfTheClaretKnight ? 'yea'
          : t.theDogsAreAtWar ? 'abstained' : 'nay',
    thorne: t.youHaventSeenTheLastOfThorne ? 'yea'
      : t.theCellMadeADealWithThorne ? 'nay'
        : t.thorneDisappeared ? 'eerilySilent' : 'abstained',
    desiderio: t.desiIsGood ? 'nay' : t.desiIsBad ? 'eerilySilent' : 'yea',
    amaranth: t.amaranthHasLeftTheCoterie ? 'abstained' : 'yea',
    tzuSanNiang: finishedEarly ? 'abstained' : t.tzuSanNiangIsUnderYourSway ? 'abstained' : 'yea',
    aliki: t.alikiIsOnYourSide ? 'nay'
      : t.youHaventSeenTheLastOfAlikiZoniUperetria ? 'eerilySilent' : 'yea',
    ece: t.eceDoesNotTrustTheCell ? 'abstained' : 'nay',
  }

  let decision
  if (t.theCellKnowsTheTrueNatureOfTheCoterie) decision = 'knowsTrueNature'
  else if (eerilySilent) decision = 'eerilySilent'
  else if (judgedLiable) decision = 'deemedALiability'
  else decision = 'vote'
  const options = decision === 'vote'
    ? [
      ...(canOverthrow ? [{ id: 'overthrow', available: true }] : [{ id: 'overthrow', available: false }]),
      ...(canJoin ? [{ id: 'join', available: true }] : [{ id: 'join', available: false }]),
      { id: 'deemedAnAsset', available: true },
    ]
    : []

  const steps = [
    { step: 1, nay: nay1, yea: yea1, section: 'dogsOfWar' },
    { step: 2, nay: nay2, yea: yea2, section: 'dealingsInTheDark' },
    { step: 3, nay: nay3, yea: yea3, section: 'deadHeat' },
    { step: 4, nay: nay4, yea: yea4, section: 'onThinIce' },
    { step: 5, nay: nay5, yea: yea5, section: 'withoutATrace' },
    { step: 6, nay: nay6, yea: yea6, section: 'dancingMad' },
    { step: 7, nay: nay7, yea: yea7, section: 'fortuneAndFolly' },
    { step: 8, nay: nay8, yea: yea8, section: 'sanguineShadows' },
    { step: 9, nay: nay9, yea: yea9, section: 'shadesOfSuffering' },
    { step: 10, nay: finalNay, yea: finalYea, section: 'tuwileMasai' },
  ]
  return {
    inputs: { ...t },
    steps,
    tally: { nay: finalNay, yea: finalYea },
    votes,
    rows: COTERIE_MEMBERS.map(member => ({
      id: member.id, name: member.name, nameEn: member.nameEn,
      enemyCode: member.enemyCode, vote: votes[member.id] || 'abstained',
    })),
    judgedLiable,
    eerilySilent: decision === 'eerilySilent',
    dogsOfWarSkipped,
    skippedDancingMad,
    laChicaRojaVotedNay,
    claretKnightVotedNay,
    eceVotedNay,
    canOverthrow: decision === 'vote' && canOverthrow,
    canJoin: decision === 'vote' && canJoin,
    options,
    decision,
  }
}

/** 结论 → 冒险设置版本（1/2/3）。 */
export function versionForDecision(decision) {
  if (decision === 'deemedALiability') return 1
  if (decision === 'knowsTrueNature' || decision === 'eerilySilent') return 3
  return 2
}

/** 结论 → 立即写入的剧本日志记录（参考实现 DoStep 2–8）。 */
export function outcomeRecordFor(decision) {
  return TRIAL_OUTCOME_RECORDS[decision] || TRIAL_OUTCOME_RECORDS.deemedAnAsset
}

// ---------------------------------------------------------------------------
// 绯红密钥：登记 / 判给 / 变换
// ---------------------------------------------------------------------------
/**
 * 登记本章用到的六把钥匙。密钥原语的 `initialize` 只允许在容器为空时调用一次；
 * 前九章玩过任意一章时容器已经存在，此时只登记**缺失**的钥匙（近似：直接写原语同一形状的记录，
 * 校验口径与 initialize 一致）。见 primitive-requests/09694-keys.json。
 */
export function ensureCongressKeys(state, api = null) {
  const keys = api?.mechanics?.tsk?.keys
  const container = (state.campaign ||= {}).tsk?.keys
  const existing = new Set(Object.keys(container?.keys || {}))
  const missing = CONGRESS_KEYS.filter(key => !existing.has(key.id))
  if (!missing.length) return { registered: [], existing: [...existing] }
  if (!keys) return { registered: [], existing: [...existing] }
  if (!existing.size) {
    try {
      keys.initialize(CONGRESS_KEYS.map(key => ({
        id: key.id, stableFace: key.stableFace, unstableFace: key.unstableFace,
      })))
      return { registered: CONGRESS_KEYS.map(key => key.id), existing: [] }
    } catch {
      /* 落回下面的逐把登记 */
    }
  }
  // 容器已存在：按 tsk-scarlet-keys 的记录形状补登记（id/面配对/持有者 none）。
  const store = (state.campaign.tsk ||= {}).keys ||= { version: 1, keys: {}, shifts: {} }
  for (const key of missing) {
    store.keys[key.id] = {
      id: key.id, stableFace: key.stableFace, unstableFace: key.unstableFace,
      stable: true, bearer: { type: 'none' }, shiftedRound: null,
    }
  }
  return { registered: missing.map(key => key.id), existing: [...existing] }
}

/** 当前面的变换声明（条目 `assetRule.keyShift`）；没有条目时返回 null。 */
export function keyShiftRuleFor(state, api, keyId) {
  const keys = api?.mechanics?.tsk?.keys
  let face = null
  try {
    face = keys?.face ? keys.face(keyId) : null
  } catch {
    face = null
  }
  if (!face) {
    const record = (state.campaign?.tsk?.keys?.keys || {})[keyId]
    face = record ? (record.stable ? record.stableFace : record.unstableFace) : null
  }
  if (!face) return null
  const entry = registeredEntry(face)
  const rule = entry?.assetRule?.keyShift || null
  const legacy = entry?.assetRule?.shift || null
  return { face, rule, legacy }
}

/**
 * 结算一次「变换」（内容层唯一执行点）：按当前面的声明结算效果，再翻面。
 * `by:'enemy'` 表示敌人持有 → 只结算效果，不翻回稳定面（且不受每轮一次限制）。
 */
export function resolveKeyShift(state, seat, api, keyId, { by = 'investigator' } = {}) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys) return null
  const record = (() => {
    try {
      return keys.get(keyId)
    } catch {
      return null
    }
  })()
  if (!record) return null
  const entry = registeredEntry(record.stable ? record.stableFace : record.unstableFace)
  const shift = entry?.assetRule?.keyShift
  const legacy = entry?.assetRule?.shift
  const flagShift = entry?.flags?.shiftEffect ? entry.flags : null
  const inv = seat == null ? null : state.investigators?.[seat]
  let effect = null
  if (shift?.resolve) {
    shift.resolve({ state, api, inv, keyId })
    effect = shift.face || 'declared'
  } else if (shift?.effect) {
    effect = applyDeclaredKeyEffect(state, seat, api, keyId, shift.effect)
  } else if (legacy) {
    effect = applyLegacyKeyShift(state, seat, api, keyId, legacy)
  } else if (flagShift) {
    effect = applyFlagsKeyShift(state, seat, api, keyId, flagShift)
  } else {
    effect = 'noDeclaration'
  }
  const flipMode = shift?.flip || null
  const shouldFlip = by === 'enemy'
    ? flipMode === 'always' && record.stable === true
    : true
  let flipped = false
  if (shouldFlip) {
    try {
      keys.shift(keyId, { force: by === 'enemy' })
      flipped = true
    } catch {
      flipped = false
    }
  }
  return { keyId, by, effect, flipped }
}

/**
 * 其它章节落在条目上的**声明式**变换效果（`assetRule.keyShift.effect`）：本章作为内容层执行点解释
 * 已实现过的 kind（与 onThinIce/rulesAndRain 的 resolveKeyShift 同一口径）。
 */
function applyDeclaredKeyEffect(state, seat, api, keyId, effect = {}) {
  const inv = seat == null ? null : state.investigators?.[seat]
  if (effect.kind === 'lookAtConcealedAtLocation') {
    const container = state.scenarioFlags?.mechanics?.tsk?.concealed
    const cards = (container?.miniCards || []).filter(card => card.locationId === inv?.location)
    for (const card of cards) card.known = true
    infoOf(api, `🔍 密钥 ${keyId}：查看「${locationName(state, inv?.location)}」${cards.length} 张迷你卡的已揭示面（不揭露）。`)
    return effect.kind
  }
  if (effect.kind === 'hollowHighestCostInHand') {
    const hollow = api?.mechanics?.tsk?.hollow
    const hollowed = []
    for (const owner of aliveInvestigators(state)) {
      const candidates = (owner.hand || []).filter(code => ALL_CARDS[code]?.subtype !== 'weakness'
        && ALL_CARDS[code]?.subtype !== 'basicweakness')
      if (!candidates.length) continue
      const code = [...candidates].sort((left, right) =>
        (Number(ALL_CARDS[right]?.cost) || 0) - (Number(ALL_CARDS[left]?.cost) || 0)
        || String(left).localeCompare(String(right)))[0]
      try {
        if (hollow) hollow.hollow({ code, source: keyId, scope: 'investigator', seat: owner.seat })
        const index = owner.hand.lastIndexOf(code)
        if (index >= 0) owner.hand.splice(index, 1)
        hollowed.push(code)
      } catch { /* 已在空洞区 */ }
    }
    infoOf(api, `🕳️ 密钥 ${keyId}：${hollowed.length} 位调查员把手中印刷费用最高的非弱点卡作为空洞。`)
    return effect.kind
  }
  if (effect.kind === 'drawEncounterTop') {
    if (typeof api?.drawEncounter === 'function' && seat != null) api.drawEncounter(seat)
    infoOf(api, `🃏 密钥 ${keyId}：抽取遭遇牌库顶 1 张。`)
    return effect.kind
  }
  if (effect.kind === 'discardRandomFromHand') {
    const amount = Math.max(1, Number(effect.amount) || 1)
    for (const owner of aliveInvestigators(state)) {
      for (let index = 0; index < amount; index += 1) {
        const code = owner.hand?.shift()
        if (code) owner.discard.push(code)
      }
    }
    infoOf(api, `🗑️ 密钥 ${keyId}：每位调查员随机弃掉 ${amount} 张手牌。`)
    return effect.kind
  }
  return effect.kind || null
}

// 旧契约（`assetRule.shift`：09565 / 09680 等先落地的章节）：本章按同一份声明结算，避免两套读点。
function applyLegacyKeyShift(state, seat, api, keyId, shift) {
  const inv = seat == null ? null : state.investigators?.[seat]
  if (shift.kind === 'healDamageHorror') {
    for (const other of aliveInvestigators(state)) {
      if (other.location !== inv?.location) continue
      api?.healDamage?.(other.seat, Number(shift.amount) || 1)
      api?.healHorror?.(other.seat, Number(shift.amount) || 1)
    }
    return 'heal'
  }
  if (shift.kind === 'discoverClue') {
    const target = inv?.location
    if (target) api?.discoverClue?.(seat, 1, target)
    return 'discoverClue'
  }
  if (shift.kind === 'discardAsset') {
    for (const owner of aliveInvestigators(state)) {
      const asset = (owner.assets || [])[0]
      if (asset) api?.discardAsset?.(owner.seat, asset.id)
    }
    return 'discardAsset'
  }
  if (shift.kind === 'loseActions') {
    const amount = Math.max(1, Number(shift.amount) || 1)
    for (const owner of aliveInvestigators(state)) api?.loseActions?.(owner.seat, amount)
    return 'loseActions'
  }
  if (shift.kind === 'discardRandomFromHand') {
    const amount = Math.max(1, Number(shift.count || shift.amount) || 1)
    for (const owner of aliveInvestigators(state)) {
      for (let index = 0; index < amount; index += 1) {
        const code = owner.hand?.shift()
        if (code) owner.discard.push(code)
      }
    }
    return 'discardRandomFromHand'
  }
  // 其余 kind（moveAndClash 等）需要敌人目标/可选步骤，留给声明该面的章节；这里只记录。
  void keyId
  return shift.kind || null
}

// 第四种声明形状（deadHeat 的密钥面）：`flags.shiftEffect` / `flags.shiftEffects`。
function applyFlagsKeyShift(state, seat, api, keyId, flags) {
  const effects = flags.shiftEffects || {}
  const inv = seat == null ? null : state.investigators?.[seat]
  if (flags.shiftEffect === 'healInvestigatorsAtBearerLocation') {
    for (const other of aliveInvestigators(state)) {
      if (other.location !== inv?.location) continue
      api?.healDamage?.(other.seat, Number(effects.healDamage) || 1)
      api?.healHorror?.(other.seat, Number(effects.healHorror) || 1)
    }
    return flags.shiftEffect
  }
  if (flags.shiftEffect === 'healAllEnemies') {
    for (const enemy of state.enemies || []) {
      if (enemy.defeated) continue
      const healed = Math.min(Number(enemy.damageTaken) || 0, Number(effects.healDamage) || 1)
      if (healed > 0) enemy.damageTaken -= healed
    }
    return flags.shiftEffect
  }
  void keyId
  return flags.shiftEffect || null
}

/** 敌人变换身上附属的每个钥匙（审判把钥匙判给敌人后由条目/剧情触发）。 */
export function shiftKeysHeldBy(state, enemy, api, times = 1) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys || !enemy?.id) return 0
  let resolved = 0
  for (const keyId of keys.heldBy({ type: 'enemy', enemyId: enemy.id })) {
    for (let index = 0; index < times; index += 1) {
      const result = resolveKeyShift(state, null, api, keyId, { by: 'enemy' })
      if (result) resolved += 1
    }
  }
  return resolved
}

/**
 * 审判的密钥归属（参考实现：被跳过的章节 → 本章把该章节的钥匙判给对应同志会成员）。
 * 敌人不在场时先记 `pendingKeyAwards`，等生成后再绑定。
 */
export function computeKeyAwards(state, trial, options = {}) {
  const t = trial?.inputs || trialInputs(state)
  const awards = []
  const skipped = (keys) => keys.every(key => t[key] === false)
  if (skipped(['theCellAidedTheKnight', 'theCellFailedToFendOffTheBeast', 'youHaventSeenTheLastOfTheClaretKnight', 'theDogsAreAtWar'])) {
    const pick = options.dogsOfWarEnemy || (randomValue(state) < 0.5 ? 'claretKnight' : 'beast')
    awards.push({ keyId: '09659', memberId: pick, reason: 'dogsOfWarSkipped' })
  }
  if (!t.eceTrustsTheCell && !t.eceDoesNotTrustTheCell) awards.push({ keyId: '09544', memberId: 'amaranth', reason: 'dealingsInTheDarkSkipped' })
  if (skipped(['youHaventSeenTheLastOfThorne', 'theCellMadeADealWithThorne', 'thorneDisappeared'])) {
    awards.push({ keyId: '09634', memberId: 'thorne', reason: 'onThinIceSkipped' })
  }
  if (skipped(['desiIsGood', 'desiIsBad', 'youHaventSeenTheLastOfDesiderioDelgadoAlvarez'])) {
    awards.push({ keyId: '09768', memberId: 'desiderio', reason: 'dancingMadSkipped' })
  }
  if (skipped(['youHaventSeenTheLastOfLaChicaRoja', 'youHaventSeenTheLastOfTheSanguineWatcher', 'theSanguineWatchersTormentContinues'])) {
    awards.push({ keyId: '09565', memberId: 'sanguineWatcher', reason: 'sanguineShadowsSkipped' })
  }
  if (skipped(['youHaventSeenTheLastOfTzuSanNiang', 'tzuSanNiangHasYouUnderHerSway', 'tzuSanNiangIsUnderYourSway'])) {
    awards.push({ keyId: '09680', memberId: 'tzuSanNiang', reason: 'shadesOfSufferingSkipped' })
  }
  return awards
}

/** 把待绑定/可绑定的密钥判给敌人（在场时立即绑定；否则留在 pendingKeyAwards）。 */
export function applyKeyAwards(state, api, awards = null) {
  const data = chapterState(state)
  const list = awards || data.pendingKeyAwards.map(entry => ({ ...entry }))
  if (awards) data.pendingKeyAwards = []
  const keys = api?.mechanics?.tsk?.keys
  const bound = []
  const pending = []
  for (const award of list) {
    const member = MEMBER_BY_ID[award.memberId]
    if (!member?.enemyCode) continue
    const enemy = (state.enemies || []).find(item => !item.defeated
      && (codeOf(item) === member.enemyCode || item.id === member.id))
    if (!enemy || !keys) {
      pending.push(award)
      continue
    }
    try {
      // 夺取（steal）：敌人持有的密钥在动荡面（与「附属到敌人的钥匙不能翻回稳定面」一致）。
      keys.steal(award.keyId, { type: 'enemy', enemyId: enemy.id })
      bound.push({ ...award, enemyId: enemy.id })
      if (!data.awardedKeys.includes(award.keyId)) data.awardedKeys.push(award.keyId)
    } catch {
      pending.push(award)
    }
  }
  data.pendingKeyAwards = [...data.pendingKeyAwards.filter(entry => !pending.some(item => item.keyId === entry.keyId))]
  // 「待绑」= 本次没能绑定的全部（每次调用都以传入清单为准，避免与已绑定项重复）。
  data.pendingKeyAwards = pending.map(entry => ({ ...entry }))
  return { bound, pending }
}

// ---------------------------------------------------------------------------
// 隐匿迷你卡（残骸之城 / 拟态克星 / 戴红手套的男子）
// ---------------------------------------------------------------------------
export const kindOf = code => CONCEALED_KINDS[code] || String(code)
export const decoyKindOf = code => `${DECOY_KIND}${kindOf(code)}`
export const isDecoyKind = kind => String(kind).startsWith(DECOY_KIND)
export const miniCardsAt = (state, locationId, position) => concealedMiniCards(state)
  .filter(card => card.locationId === locationId && (position === undefined || card.position === position))
export const concealedCountOf = code => Number(CONCEALED_PER_INVESTIGATOR[code]) || 0

/** 尽可能平均地分配（除不尽时按顺序补足；重放确定性）。 */
export function evenPlacements(cards, locationIds) {
  const ids = [...new Set(locationIds)]
  if (!ids.length) return []
  const placements = ids.map(locationId => ({ locationId, count: 0 }))
  cards.forEach((_, index) => { placements[index % ids.length].count += 1 })
  return placements.filter(entry => entry.count > 0)
}

/** 回收某组迷你卡（真身 + 该敌人的诱饵）。 */
export function clearConcealedFor(state, kind) {
  const removed = []
  for (const card of concealedMiniCards(state)) {
    if (card.kind !== kind && card.kind !== `${DECOY_KIND}${kind}`) continue
    try {
      exposeMiniCard(state, card.id)
      removed.push(card.id)
    } catch { /* 已移除 */ }
  }
  return removed.length
}

/**
 * 结算「隐匿 X」：真身迷你卡 + X 张诱饵正面朝下混洗，分配到给定地点（可指定方位）。
 * 返回创建的迷你卡（只读副本）。
 */
export function resolveConcealedAt(state, kind, { locations, amount, position = null, shuffle = null, code = null } = {}) {
  const spots = [...new Set((locations || []).filter(Boolean))]
  if (!spots.length) return []
  clearConcealedFor(state, kind)
  const cards = [{ kind, code, decoy: false }]
  for (let index = 0; index < Math.max(0, Number(amount) || 0); index += 1) {
    cards.push({ kind: `${DECOY_KIND}${kind}`, decoy: true })
  }
  const placements = evenPlacements(cards, spots)
  return distributeConcealed(state, { cards, placements, position, ...(shuffle ? { shuffle } : {}) })
}

/** 把一张迷你卡翻到「已揭示但仍在场」（近似原语的「留在场上保持揭露」；卡面明文如此）。 */
export function revealMiniCardKeep(state, miniId) {
  const container = state.scenarioFlags?.mechanics?.tsk?.concealed
  const card = container?.miniCards?.find(item => item.id === miniId)
  if (!card) return null
  card.flipped = true
  card.known = true
  const data = chapterState(state)
  if (card.decoy === true && !data.exposedDecoys.includes(miniId)) data.exposedDecoys.push(miniId)
  return { ...card }
}

/** 把所有已揭示的迷你卡翻回正面朝下（不增删；`shuffle` 决定是否重排位置）。 */
export function hideAllConcealed(state, { shuffle = false, mixed = null } = {}) {
  const container = state.scenarioFlags?.mechanics?.tsk?.concealed
  if (!container?.miniCards?.length) return 0
  for (const card of container.miniCards) {
    card.flipped = false
    card.known = false
  }
  if (shuffle) {
    if (typeof mixed === 'function') mixed()
    else {
      const slots = container.miniCards.map(card => ({ locationId: card.locationId, position: card.position }))
      for (let i = slots.length - 1; i > 0; i -= 1) {
        const j = Math.floor(randomValue(state) * (i + 1))
        ;[slots[i], slots[j]] = [slots[j], slots[i]]
      }
      container.miniCards.forEach((card, index) => {
        card.locationId = slots[index].locationId
        card.position = slots[index].position
      })
    }
  }
  return container.miniCards.length
}

/**
 * 揭露一张迷你卡（本章唯一入口）：
 *   · 环绕悖逆重力之阶：按 左→中→右 顺序；顺序不对 → 翻回全部且不混洗；
 *   · 环绕睥睨众生之巅：拟态克星的迷你卡 → 对它造成 3 点伤害并翻回 + 混洗；诱饵 → 留在场上保持揭露；
 *   · 万千纠结之塔：残骸之城 → 揭开对应的阴影地点。
 */
export function exposeAt(state, seat, miniId, api = null) {
  const card = concealedMiniCards(state).find(item => item.id === miniId)
  if (!card) return null
  const location = locationOf(state, card.locationId)
  const locationCode = codeOf(location)
  const inv = state.investigators?.[seat] ?? null
  const data = chapterState(state)
  if (locationCode === RAW_CODES.gravityDefyingClimb) return exposeAtClimb(state, seat, card, api, data)
  if (locationCode === RAW_CODES.toweringVertex) return exposeAtVertex(state, seat, card, api, data)
  if (locationCode === RAW_CODES.knottedTower) return exposeAtKnottedTower(state, seat, card, api, data)
  // 其他地点（藏身处 / 圣所）：普通揭露，诱饵离场，真身把对应敌人放到该地点。
  const result = exposeWithReaction(state, api, miniId, { seat })
  const revealed = { ...result, locationId: card.locationId }
  if (result.decoy) {
    infoOf(api, `🃏 揭露了一张诱饵（${locationName(state, card.locationId)}）。`)
    return { ...revealed, outcome: 'decoy' }
  }
  if (result.kind === kindOf(RED_GLOVED_MAN)) {
    const enemy = ensureEnemyAt(state, RED_GLOVED_MAN, card.locationId, api)
    data.redGlovedManId = enemy?.id || data.redGlovedManId || null
    infoOf(api, `🔓 揭露了「戴红手套的男子」的真身：他出现在「${locationName(state, card.locationId)}」。`)
    return { ...revealed, outcome: 'trueForm', enemyId: enemy?.id || null }
  }
  if (result.kind === kindOf(RAW_CODES.mimeticNemesis)) {
    const enemy = ensureEnemyAt(state, RAW_CODES.mimeticNemesis, card.locationId, api)
    infoOf(api, '🔓 揭露了「拟态克星」的真身。')
    return { ...revealed, outcome: 'trueForm', enemyId: enemy?.id || null }
  }
  void inv
  return { ...revealed, outcome: 'other' }
}

function exposeAtClimb(state, seat, card, api, data) {
  const expectedPosition = SHADOW_POSITIONS[data.citySequence.length] || null
  const expectedKind = expectedPosition ? CITY_OF_REMNANTS_KINDS[expectedPosition] : null
  if (card.decoy === true || (expectedKind && card.kind !== expectedKind)) {
    // 不是序列里的下一张：翻回它与其他每张迷你卡（不混洗），序列从头开始。
    data.citySequence = []
    hideAllConcealed(state, { shuffle: false })
    infoOf(api, '🌀 揭露顺序不对：所有迷你卡翻回正面朝下（不混洗），序列重新开始。')
    return { outcome: 'sequenceBroken', decoy: card.decoy === true }
  }
  revealMiniCardKeep(state, card.id)
  data.citySequence = [...data.citySequence, card.position]
  const done = data.citySequence.length >= SHADOW_POSITIONS.length
  if (done) {
    data.vertexUnlocked = true
    infoOf(api, '🗝️ 残骸之城（左→中→右）全部揭露：可以进入「睥睨众生之巅」了。')
  } else {
    infoOf(api, `🗝️ 揭露了残骸之城（${card.position === 'left' ? '左' : card.position === 'middle' ? '中' : '右'}）：`
      + '可以再揭露一张环绕此地的迷你卡。')
  }
  void seat
  return { outcome: done ? 'sequenceComplete' : 'sequenceNext', kind: card.kind, position: card.position }
}

function exposeAtVertex(state, seat, card, api, data) {
  const nemesis = (state.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === RAW_CODES.mimeticNemesis)
  if (card.decoy === true) {
    revealMiniCardKeep(state, card.id)
    infoOf(api, '🃏 睥睨众生之巅的诱饵留在场上，保持揭露。')
    return { outcome: 'decoyKept', decoy: true }
  }
  // 真身：拟态克星的迷你卡 → 3 点伤害，然后所有迷你卡翻回 + 混洗。
  revealMiniCardKeep(state, card.id)
  if (nemesis) {
    if (typeof api?.damageEnemy === 'function') api.damageEnemy(nemesis.id, 3, seat ?? null, RAW_CODES.mimeticNemesis)
    else nemesis.damageTaken = (Number(nemesis.damageTaken) || 0) + 3
    infoOf(api, '💥 「拟态克星」的真身被揭露：它受到 3 点伤害。')
  }
  hideAllConcealed(state, { shuffle: true })
  infoOf(api, '🌀 所有迷你卡翻回正面朝下并混洗。')
  void data
  return { outcome: 'nemesisRevealed', enemyId: nemesis?.id || null }
}

function exposeAtKnottedTower(state, seat, card, api, data) {
  const result = exposeWithReaction(state, api, card.id, { seat })
  if (result.decoy) {
    infoOf(api, '🃏 万千纠结之塔旁的诱饵被移除。')
    return { ...result, outcome: 'decoy' }
  }
  const position = card.position || 'middle'
  const slot = data.shadowLocations.find(entry => entry.position === position && entry.revealed !== true)
  if (slot) {
    slot.revealed = true
    infoOf(api, `🌫️ 残骸之城的阴影地点（${position === 'left' ? '左' : position === 'middle' ? '中' : '右'}）被揭示：`
      + `${slot.code}。`)
  }
  void seat
  return { ...result, outcome: 'shadowLocationRevealed', shadow: slot ? { ...slot } : null }
}

// ---------------------------------------------------------------------------
// 敌人 / 记录辅助
// ---------------------------------------------------------------------------
function ensureEnemyAt(state, code, locationId, api = null) {
  const existing = (state.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === code)
  if (existing) {
    existing.location = locationId
    existing.global = false
    return existing
  }
  const aside = (state.setAsideEnemies || []).find(enemy => codeOf(enemy) === code)
  if (aside && typeof api?.restoreEnemyFromAside === 'function') {
    const restored = api.restoreEnemyFromAside(aside.id, locationId)
    if (restored) return restored
  }
  if (typeof api?.spawn === 'function') return api.spawn(code, locationId)
  const enemy = {
    id: `congressEnemy${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: cardNameOf(code), location: locationId, exhausted: false, defeated: false, damageTaken: 0,
    traits: [...(ALL_CARDS[code]?.traits || [])], engagedSeat: null,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

function coterieEnemyOf(state, memberId) {
  const member = MEMBER_BY_ID[memberId]
  if (!member?.enemyCode) return null
  return (state.enemies || []).find(enemy => !enemy.defeated
    && (codeOf(enemy) === member.enemyCode || enemy.id === member.id)) || null
}
function readyCoterieAt(state, locationId) {
  return (state.enemies || []).some(enemy => !enemy.defeated && enemy.location === locationId
    && enemy.exhausted !== true
    && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'coterie'))
}
function hasCoterieTrait(enemy) {
  return (enemy?.traits || []).some(trait => String(trait).toLowerCase() === 'coterie')
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
function placeLocationInstance(state, id, { revealed = false, connections = null } = {}) {
  const definition = LOCATIONS[id]
  if (!definition) return null
  state.locations ||= []
  const existing = locationOf(state, id)
  if (existing) return existing
  const maxClues = clueValueOf(state, id)
  const instance = {
    ...clone(definition),
    id,
    code: definition.originalCode || definition.code,
    connections: [...(connections || definition.connections || [])],
    revealed,
    clues: revealed ? maxClues : 0,
    maxClues,
  }
  state.locations.push(instance)
  return instance
}

/** 运行时连接：在场的地点两两相连（圣堂组按卡面「波浪」互连；高塔按月牙/等号/星形连成竖列）。 */
export function connectPlacedLocations(state) {
  const placed = (state.locations || []).map(location => location.id)
  const placedSet = new Set(placed)
  for (const location of state.locations || []) {
    const definition = LOCATIONS[location.id]
    if (!definition) continue
    location.connections = [...new Set((definition.connections || []).filter(id => placedSet.has(id)))]
  }
  return placed
}

function faceOf(slot, version) {
  const face = version === 1 ? 'Lair' : 'Sanctum'
  return `${slot}${face}`
}

/**
 * 审判后的冒险设置：放地点（按版本放圣堂面或巢穴面）、生成同志会敌人、判钥匙、备好异界牌库。
 * 返回空数组：地点已由本函数写入 `state.locations`，不再交给引擎按 startLocation 迭代。
 */
export function setupLocations(state, events, helper = {}) {
  const api = helper.api || null
  const data = chapterState(state)
  if (!data.introResolved) behavior.preScenarioSetup(state, events, api || helper)
  const version = setupVersion(state) || 1
  const hallId = faceOf('scarletHalls', version)
  const sanctuaryIds = SANCTUARY_ORDER(state, helper, version)

  placeLocationInstance(state, hallId, { revealed: true })
  for (const id of sanctuaryIds) placeLocationInstance(state, id, { revealed: false })
  connectPlacedLocations(state)
  startAt(state, hallId, api)

  // 幕牌库：按版本替换幕 1a（秘密与谎言 v.I / v.II / v.III）。
  state.acts ||= []
  const firstActCode = codeOf(state.acts[0])
  if (!state.acts.length || [RAW_CODES.act1v1, RAW_CODES.act1v2, RAW_CODES.act1v3].includes(firstActCode)) {
    if (!state.acts.length) state.acts.push(clone(ACT1_VERSIONS[version]))
    else state.acts[0] = clone(ACT1_VERSIONS[version])
    state.actIndex = 0
  }

  // 区域：三张异界地点 + 拟态克星放在一边；另一面版本与未入场的藏身处地点从游戏中移除
  // （三张高塔是「放在一边」而不是移除）。
  const zones = zonesOf(state)
  zones.setAside = [...new Set([...(zones.setAside || []), ...SET_ASIDE_LOCATION_CODES, ...SET_ASIDE_CODES])]
  const removedCodes = Object.keys(LOCATIONS)
    .filter(id => !state.locations.some(location => location.id === id) && !TOWER_LOCATION_IDS.includes(id))
    .map(id => LOCATIONS[id].originalCode || LOCATIONS[id].code)
  zones.removed = [...new Set([...(zones.removed || []), ...removedCodes])]
  zones.victory ||= []

  // 密钥登记 + 审判判钥。
  const registered = ensureCongressKeys(state, api)
  const awards = computeKeyAwards(state, { inputs: data.inputs || trialInputs(state) })
  data.pendingKeyAwards = awards
  data.awardedKeys = []

  // 异界牌库（残骸之城 8 条）与第二遭遇牌库切换标记。
  data.otherworldDeck = shuffleWith(state, OTHERWORLD_LOCATION_CODES, helper)
  data.shadowLocations = []
  data.citySequence = []
  data.vertexSequence = []
  data.vertexUnlocked = false
  data.encounterDeckSwitched = false
  data.coterieIntoDeck = []

  // v.I 的第二遭遇牌库（域外篇）：幕 1 推进后由 enterOutside 换上（读 campaign.tsk.outsideEncounterDeck）。
  // 旧实现全仓无写入点 → 第二牌库切换永远是空数组，异界篇神话阶段抽不到遭遇。
  if (version === 1) {
    state.campaign ||= {}
    const campaignTsk = (state.campaign.tsk ||= {})
    campaignTsk.outsideEncounterDeck = [...SECOND_ENCOUNTER_DECK]
  }

  // 同志会敌人（按票型）与戴红手套的男子。
  const spawned = spawnCoterie(state, helper, version, data)
  applyKeyAwards(state, api)
  // 同谋支援（只有艾婕在卡表里；其余同谋版本见 scenarioGaps）。
  setupConfidants(state, helper, version, data)

  infoOf(api, `🗳️ 钥匙议会：审判结论「${data.outcome || 'vote'}」→ 冒险设置版本 ${version}；`
    + `在场同志会敌人 ${spawned.inPlay.length} 名、遭遇牌库 ${data.coterieIntoDeck.length} 张；`
    + `登记密钥 ${registered.registered.length} 把、判给同志 ${awards.length} 把。`)
  return []
}

export function SANCTUARY_ORDER(state, helper = {}, version = 1) {
  const base = ['congressChamber', 'coterieLibrary', 'keyReliquary']
  const data = state.scenarioFlags?.[STATE_KEY]
  if (Array.isArray(data?.sanctuaryOrder) && data.sanctuaryOrder.length === base.length) {
    return data.sanctuaryOrder.map(slot => faceOf(slot, version))
  }
  const shuffled = shuffleWith(state, base, helper)
  if (data) data.sanctuaryOrder = shuffled
  return shuffled.map(slot => faceOf(slot, version))
}

/** 起始地点：调查员落到猩红走廊（版本决定圣堂/巢穴面）。 */
export function startAt(state, locationId, api = null) {
  const hall = locationOf(state, locationId)
  for (const inv of state.investigators || []) {
    if (api?.moveInvestigator) api.moveInvestigator(inv.seat, locationId, { byScenarioEffect: true })
    else inv.location = locationId
  }
  return hall
}

/**
 * 按票型生成同志会敌人：
 *   · v.I：赞成的成员 + 戴红手套的男子进场（带头人以外的调查员各抽 1 张，其余洗入遭遇牌库）；
 *   · v.II：赞成成员与戴红手套的男子放在一边（不进场），没有遭遇牌库；
 *   · v.III：诡异地沉默的成员进场（同 v.I 的抽牌规则），戴红手套的男子进场。
 */
export function spawnCoterie(state, helper = {}, version = 1, data = chapterState(state)) {
  const votes = data.votes || {}
  const api = helper.api || null
  const inPlay = []
  const intoDeck = []
  const setAside = []
  const hallId = faceOf('scarletHalls', version)
  const sanctuaryLocations = (state.locations || [])
    .filter(location => location.id !== hallId)
    .map(location => location.id)
  const fallback = (state.locations || [])[0]?.id || null
  const pool = COTERIE_MEMBERS.filter(member => member.enemyCode)
  const selected = pool.filter(member => {
    const vote = votes[member.id]
    if (version === 1) return vote === 'yea'
    if (version === 3) return vote === 'eerilySilent'
    return false
  })

  // 戴红手套的男子：v.I / v.III 进场（隐匿 1/调查员）；v.II 放在一边。
  if (version === 2) {
    setAside.push(RED_GLOVED_MAN)
    data.redGlovedManId = null
    // 版本二把投票「赞成」的同志会敌人也放在一边（参考 setup：不进场、也不洗入牌库）。
    for (const member of COTERIE_MEMBERS) {
      if (!member.enemyCode || votes[member.id] !== 'yea') continue
      setAside.push(member.enemyCode)
    }
  } else {
    const spawnSpot = pickSanctuary(state, sanctuaryLocations, fallback, helper)
    const enemy = ensureEnemyAt(state, RED_GLOVED_MAN, spawnSpot, api)
    data.redGlovedManId = enemy?.id || null
    inPlay.push({ code: RED_GLOVED_MAN, enemyId: enemy?.id || null, location: spawnSpot })
    // 隐匿 1/调查员：真身迷你卡 + 1/调查员 诱饵，分布在同志会圣所（「阴影」）。
    resolveConcealedAt(state, kindOf(RED_GLOVED_MAN), {
      locations: sanctuaryLocations.length ? sanctuaryLocations : [spawnSpot],
      code: RED_GLOVED_MAN,
      amount: concealedCountOf(RED_GLOVED_MAN) * investigatorCount(state),
      shuffle: typeof helper.shuffle === 'function' ? list => helper.shuffle(list, () => helper.randomValue(state)) : null,
    })
  }

  // 其余同志会敌人：按票型抽牌/洗入遭遇牌库。
  const shuffled = shuffleWith(state, selected.map(member => member.enemyCode), helper)
  const seats = aliveInvestigators(state).filter(inv => inv.seat !== leadSeat(state))
  let cursor = 0
  for (const seat of seats) {
    const code = shuffled[cursor]
    if (!code) break
    cursor += 1
    const inv = state.investigators[seat.seat]
    const enemy = ensureEnemyAt(state, code, inv.location || fallback, api)
    inPlay.push({ code, enemyId: enemy?.id || null, location: inv.location || fallback })
  }
  intoDeck.push(...shuffled.slice(cursor))

  data.coterieIntoDeck = intoDeck
  data.coterieInPlay = inPlay.map(entry => ({ ...entry }))
  data.coterieSetAside = setAside.map(code => code)
  data.confidantVotes = votes
  // 世界卡：v.II 的赞成敌人放在一边。
  if (setAside.length) zonesOf(state).setAside = [...new Set([...(zonesOf(state).setAside || []), ...setAside])]
  return { inPlay, intoDeck, setAside }
}

function pickSanctuary(state, ids, fallback, helper) {
  if (!ids.length) return fallback
  return shuffleWith(state, ids, helper)[0] || fallback
}

/** 同谋支援：反对票的成员把其「同谋」剧情支援放进场（本仓库只有艾婕 09584）。 */
export function setupConfidants(state, helper = {}, version = 1, data = chapterState(state)) {
  const api = helper.api || null
  const votes = data.votes || {}
  const spared = version === 3 && hasRecord(state, 'theRedCoterieSparedTheCell')
  const confidants = []
  for (const member of COTERIE_MEMBERS) {
    if (!member.conspiratorCode) continue
    const vote = votes[member.id]
    const nay = vote === 'nay'
    if (!nay && !spared) continue
    confidants.push({ memberId: member.id, code: member.conspiratorCode, vote, spared })
    if (api?.spawnStoryAsset) {
      api.spawnStoryAsset(member.conspiratorCode, aliveInvestigators(state)[0]?.location || null)
    }
  }
  data.confidants = confidants
  return confidants
}

// ---------------------------------------------------------------------------
// 异界终局（幕 1 背面 / 幕 2 背面 / 幕 3 背面）
// ---------------------------------------------------------------------------
/**
 * 幕 1 背面「另一世界」：移除所有地点 → 三张高塔竖列 → 异界牌库顶 3 张进阴影
 * → 残骸之城迷你卡环绕塔底（v.II 额外按密谋 2 上的毁灭数补诱饵）→ 全员到塔底。
 */
export function enterOutside(state, api = null, { version = setupVersion(state) } = {}) {
  const data = chapterState(state)
  // 移除场上全部地点（不击败调查员；敌人与附属弃掉）。
  const shadows = state.scenarioFlags?.mechanics?.tsk?.concealed?.shadows
  for (const location of [...(state.locations || [])]) {
    // 阴影归属跟着地点一起清掉（读档校验要求 shadows 的 key 必须是在场地点）。
    if (shadows && shadows[location.id]) delete shadows[location.id]
    for (const enemy of state.enemies || []) if (enemy.location === location.id) enemy.location = null
    state.locations.splice(state.locations.indexOf(location), 1)
  }
  data.citySequence = []
  data.vertexSequence = []
  data.vertexUnlocked = false
  data.exposedDecoys = []
  hideAllConcealed(state, { shuffle: false })
  for (const card of concealedMiniCards(state)) {
    try { exposeMiniCard(state, card.id) } catch { /* 已移除 */ }
  }
  // 高塔竖列：万千纠结之塔（底）→ 悖逆重力之阶 → 睥睨众生之巅（顶）。
  for (const id of TOWER_LOCATION_IDS) placeLocationInstance(state, id, { revealed: false })
  connectPlacedLocations(state)
  for (const inv of aliveInvestigators(state)) {
    if (api?.moveInvestigator) api.moveInvestigator(inv.seat, 'knottedTower', { byScenarioEffect: true })
    else inv.location = 'knottedTower'
  }
  // 异界牌库顶 3 张 → 阴影（左/中/右）。这些地点属于共享组 beyondTheBeyond，
  // 本章没有可放置的地点定义，记在章节状态里作为阴影区标记（见 scenarioApproximations）。
  const deck = otherworldDeckOf(state)
  const top = deck.slice(0, 3)
  data.otherworldDeck = deck.slice(3)
  data.shadowLocations = SHADOW_POSITIONS.map((position, index) => ({
    position, code: top[index] || null, revealed: false,
  })).filter(entry => entry.code)

  // 残骸之城迷你卡环绕塔底：v.II 的诱饵数量 = 当前密谋上的毁灭数。
  const decoys = version === 2 ? Math.max(0, Number(state.doom) || 0) : 0
  const cards = SHADOW_POSITIONS.map(position => ({ kind: CITY_OF_REMNANTS_KINDS[position], decoy: false }))
  for (let index = 0; index < decoys; index += 1) cards.push({ kind: `${DECOY_KIND}CityOfRemnants`, decoy: true })
  distributeConcealed(state, {
    cards,
    placements: evenPlacements(cards, SHADOW_POSITIONS.map(() => 'knottedTower')),
    position: null,
  })
  // 逐张放到左/中/右（distribution 只按地点，方位在这里点名）。
  placeConcealedByPosition(state, 'knottedTower', SHADOW_POSITIONS)

  // 戴红手套的男子到塔顶（v.II 从放一边生成）。
  const redGlovedMan = ensureEnemyAt(state, RED_GLOVED_MAN, 'toweringVertex', api)
  data.redGlovedManId = redGlovedMan?.id || null
  setInShadows(state, 'toweringVertex', true)

  // 遭遇牌库：v.I 换成第二遭遇牌库（战役层提供时），其余版本如常在神话阶段抽牌。
  if (version === 1 && Array.isArray(state.campaign?.tsk?.outsideEncounterDeck)) {
    state.encounterDeck = [...state.campaign.tsk.outsideEncounterDeck]
    data.encounterDeckSwitched = true
  }
  applyKeyAwards(state, api)
  infoOf(api, `🌌 另一世界：三张高塔竖列就位，异界牌库顶 ${top.length} 张进入阴影；`
    + `残骸之城迷你卡（含 ${decoys} 张诱饵）环绕万千纠结之塔。`)
  return { top, decoys }
}

/** 把某地点上的迷你卡按「已知身份 → 左/中/右」摆放（残骸之城 L/M/R 与拟态克星都有固定方位）。 */
function placeConcealedByPosition(state, locationId, positions) {
  const container = state.scenarioFlags?.mechanics?.tsk?.concealed
  if (!container?.miniCards?.length) return 0
  const here = container.miniCards.filter(card => card.locationId === locationId)
  const fixed = { CityOfRemnantsL: 'left', CityOfRemnantsM: 'middle', CityOfRemnantsR: 'right', MimeticNemesis: 'middle' }
  const used = new Set()
  for (const card of here) {
    card.position = null
  }
  for (const card of here) {
    const position = fixed[card.kind]
    if (!position || used.has(position)) continue
    card.position = position
    used.add(position)
  }
  let cursor = 0
  for (const card of here) {
    if (card.position) continue
    while (cursor < positions.length * 4 && used.has(positions[cursor % positions.length])) cursor += 1
    card.position = positions[cursor % positions.length]
    used.add(card.position)
    cursor += 1
  }
  return here.length
}

/**
 * 幕 2 背面「入塔」：取 3 张残骸之城 + 1/调查员 诱饵，随机环绕悖逆重力之阶。
 * 幕 3 背面「窗与门」：放拟态克星在塔顶并摆它的迷你卡（2/调查员 诱饵）。
 */
export function enterClimb(state, api = null) {
  const data = chapterState(state)
  data.citySequence = []
  data.vertexUnlocked = false
  hideAllConcealed(state, { shuffle: false })
  for (const card of concealedMiniCards(state)) {
    try { exposeMiniCard(state, card.id) } catch { /* 已移除 */ }
  }
  data.shadowLocations = []
  const decoys = investigatorCount(state)
  const cards = [...SHADOW_POSITIONS.map(position => ({ kind: CITY_OF_REMNANTS_KINDS[position], decoy: false }))]
  for (let index = 0; index < decoys; index += 1) cards.push({ kind: `${DECOY_KIND}CityOfRemnants`, decoy: true })
  distributeConcealed(state, {
    cards, placements: evenPlacements(cards, SHADOW_POSITIONS.map(() => 'gravityDefyingClimb')), position: null,
  })
  placeConcealedByPosition(state, 'gravityDefyingClimb', SHADOW_POSITIONS)
  infoOf(api, `🪜 入塔：残骸之城迷你卡与 ${decoys} 张诱饵环绕悖逆重力之阶。`)
  return { decoys }
}

export function enterVertex(state, api = null) {
  const data = chapterState(state)
  data.vertexSequence = []
  hideAllConcealed(state, { shuffle: false })
  for (const card of concealedMiniCards(state)) {
    try { exposeMiniCard(state, card.id) } catch { /* 已移除 */ }
  }
  // 戴红手套的男子从游戏中移除，拟态克星在塔顶生成。
  const redGlovedMan = (state.enemies || []).find(enemy => codeOf(enemy) === RED_GLOVED_MAN)
  if (redGlovedMan) {
    if (api?.removeEnemyFromGame) api.removeEnemyFromGame(redGlovedMan)
    else state.enemies = (state.enemies || []).filter(enemy => enemy !== redGlovedMan)
  }
  data.redGlovedManId = null
  const nemesis = ensureEnemyAt(state, RAW_CODES.mimeticNemesis, 'toweringVertex', api)
  const decoys = concealedCountOf(RAW_CODES.mimeticNemesis) * investigatorCount(state)
  const cards = [{ kind: kindOf(RAW_CODES.mimeticNemesis), code: RAW_CODES.mimeticNemesis, decoy: false }]
  for (let index = 0; index < decoys; index += 1) cards.push({ kind: `${DECOY_KIND}${kindOf(RAW_CODES.mimeticNemesis)}`, decoy: true })
  distributeConcealed(state, {
    cards, placements: evenPlacements(cards, SHADOW_POSITIONS.map(() => 'toweringVertex')), position: null,
  })
  placeConcealedByPosition(state, 'toweringVertex', SHADOW_POSITIONS)
  infoOf(api, `🪟 窗与门：拟态克星在睥睨众生之巅现身（${decoys} 张诱饵）。`)
  return { nemesisId: nemesis?.id || null, decoys }
}

// ---------------------------------------------------------------------------
// 空洞 / 存在抹除
// ---------------------------------------------------------------------------
const hollowApi = api => api?.mechanics?.tsk?.hollow || null

/** 把投入本次检定的每张卡放到一边，作为空洞（[elderthing]；幂等）。 */
export function hollowCommittedCards(state, inv, result, api) {
  const data = chapterState(state)
  if (data.hollowedCommitted) return []
  const committed = Array.isArray(result?.committed) ? result.committed
    : Array.isArray(state.skillTest?.committed) ? state.skillTest.committed : []
  const hollow = hollowApi(api)
  const hollowed = []
  for (const item of committed) {
    const code = codeOf(item)
    if (!code || ALL_CARDS[code]?.type === 'weakness') continue
    const seat = Number.isInteger(item?.seat) ? item.seat : inv?.seat
    if (!Number.isInteger(seat) || hollowed.includes(code)) continue
    if ((hollowCards(state) || []).some(card => card.code === code)) continue
    try {
      if (hollow) hollow.hollow({ code, source: 'commit', scope: 'investigator', seat })
      else {
        const container = ((state.scenarioFlags ||= {}).mechanics ||= {})
        container.tsk ||= { version: 1 }
        container.tsk.hollows ||= { version: 1, cards: [] }
        container.tsk.hollows.cards.push({ code, source: 'commit', scope: 'investigator', seat })
      }
      for (const pile of ['hand', 'discard', 'deck']) {
        const list = state.investigators?.[seat]?.[pile]
        if (!Array.isArray(list)) continue
        const index = list.lastIndexOf(code)
        if (index >= 0) list.splice(index, 1)
      }
      hollowed.push(code)
    } catch { /* 已在空洞区/非法座位 */ }
  }
  data.hollowedCommitted = true
  if (hollowed.length) infoOf(api, `🕳️ [elderthing]：${hollowed.map(cardNameOf).join('、')} 放到一边，作为空洞。`)
  return hollowed
}

/** 结局 2：把全队的空洞卡写入「存在抹除」名单（战役构筑永久禁用）。 */
export function eraseHollows(state, api = null) {
  const data = chapterState(state)
  const hollow = hollowApi(api)
  const codes = (hollowCards(state) || []).map(card => card.code)
    .filter(code => !data.erasedHollows.includes(code))
  if (!codes.length) {
    const records = recordsFor(state)
    records.erasedCards = [...new Set(records.erasedCards || [])]
    return { codes: [], erased: [...(state.campaign?.tsk?.erased?.codes || [])] }
  }
  let erased = state.campaign?.tsk?.erased?.codes || []
  if (hollow) {
    try {
      erased = hollow.erase(codes)
    } catch { erased = [...erased] }
  } else {
    const campaign = ((state.campaign ||= {}).tsk ||= {})
    campaign.erased ||= { version: 1, codes: [] }
    campaign.erased.codes = [...new Set([...campaign.erased.codes, ...codes])]
    erased = campaign.erased.codes
  }
  data.erasedHollows = [...new Set([...data.erasedHollows, ...codes])]
  const records = recordsFor(state)
  records.erasedCards = [...new Set([...(records.erasedCards || []), ...codes])]
  if (codes.length) recordFact(state, 'erasedFromExistence', true)
  infoOf(api, `🕳️ 存在抹除：${codes.map(cardNameOf).join('、')} 从战役中永久移除。`)
  return { codes, erased }
}

// ---------------------------------------------------------------------------
// 地点行动（地点不建条目；按 LOCATION_RULES 分派）
// ---------------------------------------------------------------------------
export const LOCATION_ACTIONS = Object.freeze({
  scarletHallsSanctum: Object.freeze({ rule: 'fastMove', label: '[free] 横置一个[[同谋]]支援：移动到连接地点', actions: 0, conspirator: true }),
  congressChamberSanctum: Object.freeze({ rule: 'searchAsset', label: '[action] 横置一个[[同谋]]支援：查找牌库顶 6 张，抽 1 张支援', actions: 1, conspirator: true }),
  coterieLibrarySanctum: Object.freeze({ rule: 'discountAsset', label: '[action]：本轮下一张支援 -2 费用', actions: 1 }),
})

/** 场上可横置的[[同谋]]支援（本仓库只有艾婕 09584 等少数；按 traits 判定）。 */
export function conspiratorAssets(state, seat) {
  const inv = state.investigators?.[seat]
  return (inv?.assets || []).filter(asset => (ALL_CARDS[asset.code]?.traits || [])
    .some(trait => String(trait).toLowerCase() === 'conspirator'))
}

function exhaustConspirator(state, seat, api) {
  const candidates = conspiratorAssets(state, seat).filter(asset => !asset.exhausted)
  if (!candidates.length) return null
  const asset = candidates[0]
  if (typeof api?.exhaustAsset === 'function') api.exhaustAsset(asset)
  else asset.exhausted = true
  return asset
}

/** 当前位置的地点动作（`actions` 钩子用；返回 0..n 条 scenarioAction）。 */
export function locationMoves(state, inv) {
  const locationId = inv?.location
  const spec = LOCATION_ACTIONS[locationId]
  if (!spec) return []
  const hasConspirator = conspiratorAssets(state, inv.seat).some(asset => !asset.exhausted)
  const moves = [{
    action: 'scenarioAction', rule: `loc:${spec.rule}`, locationId, label: spec.label,
    actions: Number(spec.actions ?? 1),
    ...(spec.conspirator && !hasConspirator ? { reason: '需要一个未横置的[[同谋]]支援' } : {}),
  }]
  // 书库圣堂的第二个入口：横置同谋支援，把 [action] 能力改为 [free] 激活。
  if (spec.rule === 'discountAsset') {
    moves.push({
      action: 'scenarioAction', rule: 'loc:discountAssetFast', locationId, actions: 0,
      label: '[free] 横置一个[[同谋]]支援：本轮下一张支援 -2 费用',
      ...(hasConspirator ? {} : { reason: '需要一个未横置的[[同谋]]支援' }),
    })
  }
  return moves
}

export function performLocationAction(state, inv, move, api) {
  const rule = String(move?.rule || '')
  const locationId = inv?.location
  if (rule === 'loc:fastMove') {
    const asset = exhaustConspirator(state, inv.seat, api)
    if (!asset) return false
    const connections = (locationOf(state, locationId)?.connections || []).filter(id => locationOf(state, id))
    if (!connections.length) return false
    const picked = connections.length === 1 ? connections[0] : choiceFor(api, {
      kind: 'location', source: locationId, seat: inv.seat, prompt: '移动到连接地点。',
      options: connections.map(id => ({ id, label: locationName(state, id) })),
    })
    const destination = connections.includes(picked) ? picked : connections[0]
    if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, destination)
    else inv.location = destination
    infoOf(api, `🚶 ${inv.name} 横置「${cardNameOf(asset.code)}」并移动到「${locationName(state, destination)}」。`)
    return true
  }
  if (rule === 'loc:searchAsset') {
    const asset = exhaustConspirator(state, inv.seat, api)
    if (!asset) return false
    if (typeof api?.searchTop === 'function') api.searchTop(inv.seat, { amount: 6, typeFilter: 'asset', choose: 1 })
    infoOf(api, '🔎 查找牌库顶 6 张，找出一张支援并抽取，其余洗回牌库。')
    return true
  }
  if (rule === 'loc:discountAsset' || rule === 'loc:discountAssetFast') {
    const data = chapterState(state)
    if (rule === 'loc:discountAssetFast') {
      const asset = exhaustConspirator(state, inv.seat, api)
      if (!asset) return false
    }
    data.assetDiscount = { seat: inv.seat, amount: 2, round: Number(state.round) || 0, used: false }
    infoOf(api, `🏷️ 本轮 ${inv.name} 打出的下一张支援费用 -2。`)
    return true
  }
  return false
}

/** 支持类费用修正：巢穴议会室 +2；书库圣堂的 -2 折扣（章节状态记账）。 */
export function congressPlayCost({ state, inv }) {
  if (!state || !inv) return 0
  if (String(state.scenario?.id || '') !== CHAPTER_ID) return 0
  let total = 0
  if (inv.location === 'congressChamberLair' && readyCoterieAt(state, inv.location)) total += 2
  const discount = state.scenarioFlags?.[STATE_KEY]?.assetDiscount
  if (discount && discount.seat === inv.seat && discount.used !== true
    && Number(discount.round) === Number(state.round)) total -= Number(discount.amount) || 0
  return total
}

// 注册期一次（内容层唯一外部修正源；未注册时为 0）。
const PROVIDER_FLAG = Symbol.for('tsk.congressOfTheKeys.playCostProvider')
if (!globalThis[PROVIDER_FLAG]) {
  registerModifierProvider('playCost', congressPlayCost)
  globalThis[PROVIDER_FLAG] = true
}

/** 注能：藏钥馆圣堂「改为给钥匙注能」的读点（章节状态记账；没有引擎原语）。 */
export function empowerKey(state, keyId) {
  const data = chapterState(state)
  data.empowered ||= {}
  data.empowered[keyId] = true
  return keyId
}
export function isKeyEmpowered(state, keyId) {
  return state.scenarioFlags?.[STATE_KEY]?.empowered?.[keyId] === true
}

/** 调查藏钥馆圣堂成功后的反应（`investigateResult` 钩子）。 */
export function keyReliquaryChoice(state, inv, location, result, api) {
  if (!result?.success) return true
  const data = chapterState(state)
  const keys = api?.mechanics?.tsk?.keys
  if (!keys) return true
  const candidates = []
  for (const other of aliveInvestigators(state)) {
    if (other.location !== location.id) continue
    for (const keyId of keys.heldBy({ type: 'investigator', seat: other.seat })) {
      if (data.empowered?.[keyId]) continue
      candidates.push({ keyId, seat: other.seat })
    }
  }
  if (!candidates.length) return true
  const answer = candidates.length === 1 ? String(candidates[0].keyId) : choiceFor(api, {
    kind: 'key', source: '09710', seat: inv.seat,
    prompt: '不发现线索，改为给一把未注能的钥匙注能？',
    options: [{ id: 'skip', label: '改为正常发现线索' },
      ...candidates.map(entry => ({ id: entry.keyId, label: `注能密钥 ${entry.keyId}` }))],
  })
  if (!answer || answer === 'skip') return true
  const chosen = candidates.find(entry => entry.keyId === answer)
  if (!chosen) return true
  empowerKey(state, chosen.keyId)
  infoOf(api, `🔑 藏钥馆：密钥 ${chosen.keyId} 获得 1 点注能（变换时可花费注能代替翻面）。`)
  return false
}

/** 藏钥馆巢穴：每个[[动荡]]钥匙 +2 隐藏值（`locationShroudModifier` 钩子）。 */
export function keyReliquaryShroud(state, location) {
  if (!location) return 0
  const code = codeOf(location)
  if (code !== RAW_CODES.keyReliquaryLair) return 0
  const unstable = (state.campaign?.tsk?.keys?.keys || {})
  const count = Object.values(unstable).filter(record => record.stable === false).length
  return count * 2
}

// ---------------------------------------------------------------------------
// 幕/密谋推进
// ---------------------------------------------------------------------------
function actCode(state) {
  return codeOf((state.acts || [])[state.actIndex])
}
function agendaCode(state) {
  return codeOf((state.agendas || [])[state.agendaIndex])
}
function redGlovedManEnemy(state) {
  return (state.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === RED_GLOVED_MAN) || null
}

/** 幕 1 的线索目标地点跟着戴红手套的男子走（`objective.atLocation` 是数据，随他移动同步）。 */
export function syncActObjective(state) {
  const act = (state.acts || [])[state.actIndex]
  if (!act || act.objective?.type !== 'clues') return null
  const enemy = redGlovedManEnemy(state)
  const locationId = enemy?.location || null
  if (locationId) act.objective.atLocation = locationId
  return locationId
}

/** 密谋 1 的「跳过 b 面」判定：当前是幕 2/3/4 时直接进入密谋 2a。 */
export function agenda1SkipsBack(state) {
  const act = (state.acts || [])[state.actIndex]
  const stage = String(act?.stage || '')
  return /^[234]/.test(stage)
}

// ---------------------------------------------------------------------------
// 近似披露 / 缺口（先声明，behavior 对象直接引用）
// ---------------------------------------------------------------------------
export const scenarioApproximations = Object.freeze([
  '审判的 11 票按参考实现的 10 段增量计票（`steps`）逐段累计；票型表 `votes` 与参考实现的 votes Map 逐项一致，'
    + '但「情人重聚」额外 +1 赞成只体现在增量计票里（那一票是拉辛·法瑞，不是同志会成员）。',
  '德西的「好/坏面」没有存档字段（参考实现记物理卡版本 09606/09607）：本章用 `desiIsInYourDebt`/'
    + '`theCellMadeADealWithDesi` 近似好面，用 `youHaventSeenTheLastOfDesiderioDelgadoAlvarez` 近似坏面。',
  '同谋（Conspirator）剧情支援只有艾婕 09584 在本仓库卡表里；其余同谋版本（戴红手套的男子、红衣女郎、'
    + '暗红骑士、索恩、德西、艾里奇）不在卡表，本章只把票型记进 `confidants`（不生成资产）。',
  '异界牌库顶的 3 张「残骸之城」地点属于共享组 beyondTheBeyond，本仓库没有它们的卡表地点定义：'
    + '本章把它们记进章节状态 `shadowLocations`（左/中/右 + 是否已揭示）作为阴影区标记，不实际放置地点实体。',
  '本仓库卡表只收录 8 张残骸之城记录（印刷组 9 张）：异界牌库按 8 条洗牌，且 `shadowLocations` 只取前 3 条。',
  '「立即结算额外一个敌军阶段」（密谋 1b v.I / v.III）没有引擎原语：本章记录并提示，敌军阶段不重复结算。',
  '幕 1 v.II「神话阶段不抽遭遇卡」用空遭遇牌库表达（与食梦者的「开局没有遭遇牌库」同口径）；'
    + '幕 1 推进后才由 `enterOutside` 建立第二遭遇牌库（战役层提供 `campaign.tsk.outsideEncounterDeck` 时）。',
  '「残骸之城地点在阴影左/中/右」与「戴红手套的男子在阴影中」都用 `tsk-concealed` 的 position 表达；'
    + '阴影地点本身（`shadowLocations`）是章节状态，不是引擎实体。',
  '戴红手套的男子生成在一张同志会圣所，并把他的迷你卡（1/调查员 诱饵）分布到各圣所地点上'
    + '（引擎没有「敌人在阴影区、不在任何地点」的形状）。',
  '「已揭露但留在场上」的迷你卡用 `flipped/known` 直接标记近似（原语 `exposeMiniCard` 会取出迷你卡）；'
    + '幕 4 的「移除一个已揭露的诱饵」读 `exposedDecoys` 名单。',
  '拟态克星的「将要受到攻击或玩家卡伤害时揭示一张迷你卡」读 `enemyDamageAllowed`：'
    + '引擎不区分攻击/玩家卡与剧本伤害，因此对所有来源的伤害都要求揭示，且揭示哪一张由确定性顺序决定'
    + '（该读点拿不到 api，无法询问；见 primitive-requests/09694.json）。',
  '藏钥馆圣堂的「注能」没有引擎原语：注能记在章节状态 `empowered`，变换时是否花费注能只由本章提示，'
    + '不会自动替代翻面。',
  '「猩红走廊（巢穴）进入后移动的额外费用」在 `locationEntered` 记账，但没有引擎读点强制多花 1 行动'
    + '（`moveError` 只能拦路、不能加价）：本章只记录并提示。',
  '书库圣堂的「下一张支援 -2 费用」用外部修正源 `registerModifierProvider("playCost")` 实现，'
    + '在支援入场（`assetEntered`）时消耗；巢穴议会室的「有重整[[结社]]敌人时支援 +2」用同一读点。',
  '结局 1 的「经验 = 胜利区胜利 X 之和 + 5」由引擎的 `state.victory + bonus` 结算；'
    + '结局 2 的「战役失败」由战役层按 `theCellWasHollowed` 记录处理。',
  '审判计票里「诡异地沉默」的判定包含戴红手套的男子（+1）：这是参考实现的口径，不是卡面文字。',
])
export const scenarioGaps = Object.freeze([
  '共享遭遇组（域外使徒/彼界彼端/域外来客/秘密战争/远古恶魔/恐惧打击/猩红巫术/空间异常/腐败扩散/上锁的门）'
    + '的卡牌行为属于共享组 worker；本章只声明 requiredEncounterGroupIds 与子集（恐惧打击 01164/01165）。',
  '第二遭遇牌库（域外篇）需要战役层按 requiredEncounterGroupIds 组装并写入 `campaign.tsk.outsideEncounterDeck`；'
    + '本章只负责切换标记。',
  '「敌人变换附属钥匙」的通用时机窗口（`tskKeyShifted`）仍无引擎开窗点：本章的 `resolveKeyShift` 是'
    + '内容层唯一执行点，条目里的 forced 声明不会被自动触发。',
  '六把密钥的 Shift 声明有四种形状（`assetRule.keyShift.resolve` / `assetRule.keyShift.effect` / '
    + '`assetRule.shift` / `flags.shiftEffect`）：本章的 `behavior.resolveKeyShift` 是内容层唯一执行点，'
    + '前三种按 kind 逐个解释；需要敌人目标或可选步骤的 kind（09680a 的 `moveAndClash`）只记录不结算。',
  '世界地图的时间阈值与尾声分支由战役流程层结算；本章只写 `time`/`keysHeld`/`chaptersCompleted`/`erasedCards`。',
])

// ---------------------------------------------------------------------------
// behavior（引擎钩子）
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  // 本章目录下真正有单卡条目的卡号（地点/幕/密谋/提示卡不建条目）。
  implementedEncounterCodes: Object.freeze([RAW_CODES.mimeticNemesis]),
  // 本章会生成/引用、但条目落在共享组目录的遭遇卡（不参与本章一卡一文件守卫）。
  referencedEncounterCodes: Object.freeze([...COTERIE_ENEMY_CODES, RED_GLOVED_MAN]),
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: CONGRESS_TOKEN_MEANINGS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,
  resolutions: Object.keys(resolutions),
  gatherGroups: GATHER_GROUPS,
  // 版本决定的起始地点（引擎 setup 的 startLocation 读点）。
  startLocation(state) {
    return START_LOCATION_BY_VERSION[setupVersion(state)] || START_LOCATION_BY_VERSION[2]
  },

  // ---- 开场：审判（投票 → 结论 → 版本）----
  preScenarioSetup(state, events, api) {
    const data = chapterState(state)
    if (data.introResolved) return data
    // 先结算密钥登记（审判判钥需要实体存在），再计票。
    ensureCongressKeys(state, api)
    const inputs = trialInputs(state)
    const trial = computeTrial(inputs)
    data.inputs = inputs
    data.steps = trial.steps
    data.tally = trial.tally
    data.votes = trial.votes
    data.rows = trial.rows
    data.decision = trial.decision
    data.introResolved = true
    // 结论：投票结论在可用选项里让领队选择（颠覆/加入/被当作资产），其余自动。
    let outcome = trial.decision
    if (trial.decision === 'vote') {
      const available = trial.options.filter(option => option.available).map(option => option.id)
      const picked = available.length === 1 ? available[0] : choiceFor(api, {
        kind: 'story', source: 'congressTrial', seat: leadSeat(state),
        prompt: `审判结果：反对 ${trial.tally.nay} / 赞成 ${trial.tally.yea}。选择你的命运。`,
        options: trial.options.filter(option => option.available).map(option => ({
          id: option.id, label: SCENARIO_TEXT.introChoices.find(entry => entry.id === option.id)?.label || option.id,
        })),
      })
      outcome = available.includes(picked) ? picked : available[0]
    }
    data.outcome = outcome
    const version = versionForDecision(outcome)
    data.setupVersion = version
    data.version3 = version === 3
    const record = outcomeRecordFor(outcome)
    recordFact(state, record, true)
    if (outcome === 'eerilySilent') recordFact(state, 'theRedCoterieWasDestroyedFromWithin', true)
    // 审判摘要（日志）+ 计票明细。
    infoOf(api, `🗳️ 同志会审判：反对 ${trial.tally.nay} / 赞成 ${trial.tally.yea}`
      + `（${trial.rows.map(row => `${row.name}:${row.vote}`).join('、')}）。`)
    infoOf(api, `📜 记录「${cardNameOf(record)}」；进入冒险设置版本 ${version}。`)
    return data
  },

  // ---- 布置 ----
  // 2026-11-13 P0：遭遇牌库按审判结论的版本构造（旧实现恒空 → 神话阶段永远无遭遇），
  // 并把 setup 阶段算出的「洗入牌库的同志会敌人」（data.coterieIntoDeck）追加进去。
  // 读点：setup.js#setupScenarioDecks 在 locations/enemies 之后调 modifyDeck，此处版本已确定。
  modifyDeck(state, deck) {
    const data = chapterState(state)
    const codes = encounterDeckForVersion(setupVersion(state) || 2)
    const coterie = Array.isArray(data.coterieIntoDeck) ? data.coterieIntoDeck : []
    return [...codes, ...coterie]
  },

  setupLocations(state, events, helper = {}) {
    return setupLocations(state, events, helper)
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    const options = { attackOutsider: isFightAgainstOutsider(state) }
    const resolved = congressChaosToken(state, inv, token, options)
    if (!resolved) return null
    // [cultist]：可以翻一个稳定钥匙，把修正值改为 -2 / -4（先问再翻）。
    if (token === 'cultist') {
      const keys = api?.mechanics?.tsk?.keys
      const stable = keys ? keys.heldBy({ type: 'investigator', seat: inv?.seat }).filter(id => {
        try { return keys.get(id)?.stable === true } catch { return false }
      }) : []
      if (stable.length) {
        const options = [{ id: 'skip', label: `不翻（${resolved.delta}）` }]
        for (const id of stable) {
          const stableFace = KEY_BY_ID[id]?.stableFace || id
          options.push({ id, label: `把「${cardNameOf(stableFace)}」翻至动荡面（${resolved.flipDelta}）` })
        }
        const answer = choiceFor(api, {
          kind: 'choice', source: 'congressCultist', seat: inv.seat,
          prompt: `[cultist]：翻一个稳定钥匙，把修正值改为 ${resolved.flipDelta}？`, options,
        })
        if (answer && answer !== 'skip' && stable.includes(answer)) {
          try {
            keys.shift(answer, { force: true })
            infoOf(api, `🔑 [cultist]：${inv.name} 把密钥 ${answer} 翻至动荡面，本标记修正改为 ${resolved.flipDelta}。`)
            return { delta: resolved.flipDelta, rider: 'cultistKeyFlip', flipped: answer }
          } catch { /* 翻面失败按原值 */ }
        }
      }
    }
    return resolved
  },

  // ---- 检定后的标记后果 ----
  afterTest(state, inv, result, api) {
    const riders = congressAfterTest(state, inv, result)
    for (const rider of riders) {
      if (rider === 'hollowCommitted') hollowCommittedCards(state, inv, result, api)
    }
    // 新的一次检定：允许下一次 [elderthing] 重新结算。
    if (!riders.includes('hollowCommitted')) chapterState(state).hollowedCommitted = false
    return riders
  },

  // ---- 密谋 ----
  // 密谋 1：当前是幕 2/3/4 时跳过 b 面（引擎翻面后由 agendaReveal 判定）。
  agendaWouldAdvance(state) {
    syncActObjective(state)
    return false
  },
  agendaAdvancing(state, agenda) {
    const data = chapterState(state)
    data.pendingAgenda = codeOf(agenda)
  },
  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    if (code === RAW_CODES.agenda1) {
      if (agenda1SkipsBack(state)) {
        infoOf(api, '⏭️ 当前是幕 2/3/4：跳过「因果汇流」的 b 面，直接进入密谋 2a。')
        return
      }
      const version = setupVersion(state)
      if (version === 2) {
        // 版本二：在密谋 2a 上放 4 个毁灭，并推进幕。
        chapterState(state).doomOnNextAgenda = 4
        infoOf(api, '🌑 「因果汇流」b 面：在密谋 2a 上放置 4 个毁灭，然后推进场景。')
        if (typeof api?.advanceAct === 'function') api.advanceAct()
        return
      }
      // 版本一/三：每个敌人变换身上附属的每个钥匙，然后立即结算额外一个敌军阶段。
      let shifted = 0
      for (const enemy of state.enemies || []) {
        if (enemy.defeated) continue
        shifted += shiftKeysHeldBy(state, enemy, api)
      }
      infoOf(api, `🔑 每个敌人变换身上附属的钥匙（共 ${shifted} 次）。`)
      if (version === 3) {
        const keys = api?.mechanics?.tsk?.keys
        const stable = keys ? keys.all().filter(record => record.stable) : []
        const amount = investigatorCount(state)
        for (const record of stable.slice(0, amount)) {
          try {
            keys.shift(record.id, { force: true })
          } catch { /* 已变换 */ }
        }
        infoOf(api, `🔑 版本三：把 ${Math.min(amount, stable.length)} 把钥匙翻至动荡面。`)
      }
      infoOf(api, '⚔️ 立即结算额外一个敌军阶段（近似：只记录并提示，引擎没有「额外敌军阶段」原语）。')
      return
    }
    if (code === RAW_CODES.agenda2) {
      // 跨维震撼：诱饵翻回、混洗所有迷你卡；每位调查员 2 伤害 2 恐惧（可用钥匙取消）。
      hideAllConcealed(state, { shuffle: true })
      for (const inv of aliveInvestigators(state)) transdimensionalShock(state, inv, api)
      return
    }
    if (code === RAW_CODES.agenda3) {
      infoOf(api, '☠️ 万物尽红：每位调查员被击败。')
      for (const inv of aliveInvestigators(state)) {
        if (typeof api?.defeatInvestigator === 'function') api.defeatInvestigator(inv.seat)
        else inv.defeated = true
      }
      if (typeof api?.finish === 'function') api.finish('resolution2')
    }
  },
  agendaChain(state, next, api) {
    const data = chapterState(state)
    if (Number(data.doomOnNextAgenda) > 0) {
      const amount = Number(data.doomOnNextAgenda) || 0
      data.doomOnNextAgenda = 0
      if (typeof api?.addDoom === 'function') api.addDoom(amount)
      else state.doom = (Number(state.doom) || 0) + amount
      infoOf(api, `🌑 在「${next?.name || '密谋'}」上放置 ${amount} 个毁灭。`)
    }
    return false
  },

  // ---- 幕 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    if (code === RAW_CODES.act1v1 || code === RAW_CODES.act1v2 || code === RAW_CODES.act1v3) {
      enterOutside(state, api, { version: setupVersion(state) || Number(act.version) || 1 })
      return
    }
    if (code === RAW_CODES.act2) {
      enterClimb(state, api)
      return
    }
    if (code === RAW_CODES.act3) {
      enterVertex(state, api)
      return
    }
    if (code === RAW_CODES.act4) {
      if (typeof api?.finish === 'function') api.finish('resolution1')
    }
  },
  // 幕 1 需要回合结束才能支付线索推进（引擎读点）。
  roundEndActIndex(state) {
    const act = (state.acts || [])[state.actIndex]
    if (!act) return -1
    if (act.objective?.type !== 'clues') return -1
    syncActObjective(state)
    return Number(state.actIndex)
  },
  checkObjectives(state, api) {
    syncActObjective(state)
    const code = actCode(state)
    if (code === RAW_CODES.act1v2) {
      // 版本二：任意回合结束时若全员同地点，可以推进（提示由剧本行动给出）。
      return false
    }
    void api
    return false
  },

  // ---- 地点 / 移动 ----
  investigatorEntryError(state, location, inv) {
    const code = codeOf(location)
    if (code === RAW_CODES.toweringVertex && !vertexUnlocked(state)) {
      return '睥睨众生之巅被空间锁住：必须先在悖逆重力之阶按 左→中→右 揭露残骸之城。'
    }
    // 版本二的藏身处没有入口限制；其它地点的额外费用在 beforeMove 里结算。
    void inv
    return null
  },
  beforeMove(state, inv, destination, api, options = {}) {
    if (!destination) return true
    if (options?.reason === 'effect') return true
    if (codeOf(destination) !== RAW_CODES.gravityDefyingClimb) return true
    if (destination.revealed === true) return true
    const tower = locationOf(state, 'knottedTower')
    const required = Number(LOCATION_RULES.gravityDefyingClimb.enterCost?.cluesPerInvestigator || 4) * investigatorCount(state)
    const data = chapterState(state)
    if (data.climbCluesPaid) return true
    const payers = aliveInvestigators(state).filter(one => !tower || one.location === tower.id)
    const available = payers.reduce((sum, one) => sum + (Number(one.clues) || 0), 0)
    if (available < required) {
      infoOf(api, `⛓️ 进入悖逆重力之阶的额外费用：万千纠结之塔的调查员需共同花费 ${required} 个线索`
        + `（现有 ${available}）。`)
      return false
    }
    if (typeof api?.payGroupClues === 'function') api.payGroupClues(required, { atLocation: tower?.id })
    else for (const one of payers) one.clues = 0
    data.climbCluesPaid = true
    infoOf(api, `⛓️ 万千纠结之塔的调查员共同花费 ${required} 个线索，进入悖逆重力之阶的大门开启。`)
    void inv
    return true
  },
  locationShroudModifier(state, location) {
    return keyReliquaryShroud(state, location)
  },
  // 猩红走廊（巢穴）进入后的额外移动费用：记账（引擎没有「进入后加价」读点，见近似披露）。
  locationEntered(state, inv, location, api) {
    const code = codeOf(location)
    const data = chapterState(state)
    if (code === RAW_CODES.scarletHallsLair) {
      data.hallExtraCost ||= {}
      data.hallExtraCost[inv.seat] = Number(state.round) || 0
    }
    if (code === RAW_CODES.toweringVertex && !data.vertexEnteredLogged) {
      data.vertexEnteredLogged = true
      infoOf(api, '🏔️ 调查员登上了睥睨众生之巅。')
    }
  },
  // 调查结果窗口：藏钥馆圣堂的注能反应。
  investigateResult(state, inv, location, result, api) {
    if (codeOf(location) !== RAW_CODES.keyReliquarySanctum) return true
    return keyReliquaryChoice(state, inv, location, result, api)
  },
  // 支援入场：消耗书库圣堂的 -2 折扣。
  assetEntered(state, inv, asset) {
    const discount = state.scenarioFlags?.[STATE_KEY]?.assetDiscount
    if (!discount || discount.seat !== inv?.seat || discount.used === true) return
    if (Number(discount.round) !== Number(state.round)) return
    if (!asset) return
    discount.used = true
  },
  // 敌人受伤：读条目声明的 `enemyRule.damageRevealsConcealedMiniCard`（拟态克星）。
  enemyDamageAllowed(state, enemy, source, seat) {
    const rule = registeredEntry(codeOf(enemy))?.enemyRule
    if (rule?.damageRevealsConcealedMiniCard !== true) return undefined
    if (enemyTextBlanked(state, enemy)) return undefined
    return mimeticNemesisDamageShield(state, enemy, seat, source)
  },
  // 敌人被击败：戴红手套的男子在塔顶不能被击败。
  enemyCanBeDefeated(state, enemy) {
    if (codeOf(enemy) !== RED_GLOVED_MAN) return true
    if (codeOf(locationOf(state, enemy.location)) !== RAW_CODES.toweringVertex) return true
    return false
  },
  // 敌人移动后：同步幕 1 目标地点 + 重绑待判密钥。
  enemyMoved(state, enemy, previous, api) {
    if (codeOf(enemy) === RED_GLOVED_MAN) syncActObjective(state)
    if (hasCoterieTrait(enemy)) applyKeyAwards(state, api)
    void previous
  },
  enemySpawned(state, enemy, api) {
    if (hasCoterieTrait(enemy)) applyKeyAwards(state, api)
  },

  // ---- 剧本行动 ----
  actions(state, inv) {
    if (!inv) return []
    const moves = [...locationMoves(state, inv)]
    const data = chapterState(state)
    // 幕 4 的 [action]：翻一个稳定钥匙，移除一张已揭露的诱饵（从游戏中移除）。
    if (actCode(state) === RAW_CODES.act4 && (data.exposedDecoys || []).length) {
      moves.push({
        action: 'scenarioAction', rule: 'act4:removeDecoy',
        label: '[action] 将你控制的一个[[稳定]]钥匙翻至[[动荡]]面：将一个已揭露的诱饵从游戏中移除',
      })
    }
    // 版本二幕 1：任意回合结束时可以出发。
    if (actCode(state) === RAW_CODES.act1v2) {
      const sameLocation = new Set(aliveInvestigators(state).map(one => one.location)).size <= 1
      moves.push({
        action: 'scenarioAction', rule: 'act1v2:depart',
        label: '出发进入域外（准备就绪后推进幕 1）',
        ...(sameLocation ? {} : { reason: '需要所有调查员在同一地点' }),
      })
    }
    // 万千纠结之塔：有地点放置在相邻处后可以移过去。
    if (inv.location === 'knottedTower' && (data.shadowLocations || []).some(entry => entry.revealed)) {
      moves.push({ action: 'scenarioAction', rule: 'tower:moveToShadow', label: '移动到刚才放置的相邻地点' })
    }
    return moves
  },
  performAction(state, inv, move, api) {
    const rule = String(move?.rule || '')
    if (rule.startsWith('loc:')) return performLocationAction(state, inv, move, api)
    if (rule === 'act1v2:depart') {
      if (new Set(aliveInvestigators(state).map(one => one.location)).size > 1) return false
      infoOf(api, '🚪 特别小组准备就绪，出发进入域外。')
      if (typeof api?.advanceAct === 'function') api.advanceAct()
      return true
    }
    if (rule === 'act4:removeDecoy') {
      const data = chapterState(state)
      const keys = api?.mechanics?.tsk?.keys
      const stable = keys ? keys.heldBy({ type: 'investigator', seat: inv.seat }).filter(id => {
        try { return keys.get(id)?.stable === true } catch { return false }
      }) : []
      if (!stable.length) return false
      try {
        keys.shift(stable[0], { force: true })
      } catch { return false }
      const removed = data.exposedDecoys.shift()
      infoOf(api, `🔑 翻面密钥 ${stable[0]}，把一个已揭露的诱饵从游戏中移除（${removed || '—'}）。`)
      return true
    }
    if (rule === 'tower:moveToShadow') {
      const shadow = (chapterState(state).shadowLocations || []).find(entry => entry.revealed)
      infoOf(api, `🌫️ 万千纠结之塔：移动到刚放置的相邻地点（${shadow?.code || '阴影'}）。`)
      return Boolean(shadow)
    }
    return false
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const data = chapterState(state)
    const finished = []
    const finish = record => {
      if (!record) return
      recordFact(state, record, true)
      finished.push(record)
    }
    // 被击败的调查员先结算「调查员被击败」：由引擎的战役结算（eliminateInvestigator/updateCampaignStatus）
    // 处理发疯与记忆抹除，本章只按印刷朗读正文。
    if (key === 'resolution2' || key === 'noResolution') {
      // 结局 2：特别小组成为空洞（战役失败）；空洞卡写入存在抹除名单。
      finish('theCellWasHollowed')
      const erased = eraseHollows(state, api)
      markChapterCompleted(state)
      infoOf(api, '☠️ 结局 2：特别小组成为空洞 —— 调查员剧本失败。')
      return { bonus: 0, alive: false, erased: erased.codes, story: resolutions.resolution2, records: finished }
    }
    // 结局 1：域外来客遭到阻止。
    finish('theOutsidersWereStopped')
    for (const inv of state.investigators || []) {
      if (typeof api?.addTrauma === 'function') {
        api.addTrauma(inv.seat, 'physical', RESOLUTION1_TRAUMA.physical)
        api.addTrauma(inv.seat, 'mental', RESOLUTION1_TRAUMA.mental)
      }
    }
    // 密钥归属：调查员持有的写进剧本日志；敌人持有的记为「被同志会夺走」。
    const keys = api?.mechanics?.tsk?.keys
    if (keys) {
      for (const record of keys.all()) {
        if (record.bearer?.type === 'investigator') setKeyHeld(state, record.id, true)
        else setKeyHeld(state, record.id, false)
      }
    }
    data.keysAtEnd = (state.campaign?.tsk?.keys?.keys
      ? Object.values(state.campaign.tsk.keys.keys).map(record => ({ ...record, bearer: { ...record.bearer } }))
      : [])
    markChapterCompleted(state)
    infoOf(api, `🏁 结局 1：域外来客遭到阻止（+${RESOLUTION1_BONUS_XP} 奖励经验，每位调查员 2 点肉体创伤与 2 点精神创伤）。`)
    return {
      bonus: RESOLUTION1_BONUS_XP,
      alive: true,
      erased: [],
      story: resolutions.resolution1,
      records: finished,
      keys: data.keysAtEnd,
    }
  },
  // 没有达成任何结局时的兜底（全灭）→ 结局 2。
  finalResolution(state) {
    const data = chapterState(state)
    if (data.pendingResolution) return data.pendingResolution
    return 'resolution2'
  },
}

// behavior 已引用同一份近似/缺口数组（见文件上方 const 声明）。

// ---------------------------------------------------------------------------
// 只读投影（桌面/测试用；不写状态）
// ---------------------------------------------------------------------------
export function chapterSummary(state) {
  const data = state?.scenarioFlags?.[STATE_KEY] || {}
  return {
    version: Number(data.setupVersion) || 1,
    outcome: data.outcome || null,
    tally: data.tally ? { ...data.tally } : null,
    votes: { ...(data.votes || {}) },
    rows: (data.rows || []).map(row => ({ ...row })),
    confidants: (data.confidants || []).map(entry => ({ ...entry })),
    keys: (data.awardedKeys || []).slice(),
    pendingKeys: (data.pendingKeyAwards || []).map(entry => ({ ...entry })),
    otherworldDeck: otherworldDeckOf(state),
    shadowLocations: shadowLocationsOf(state),
    citySequence: [...(data.citySequence || [])],
    vertexUnlocked: data.vertexUnlocked === true,
    exposedDecoys: [...(data.exposedDecoys || [])],
    concealed: concealedMiniCards(state).map(card => ({
      id: card.id, kind: card.kind, decoy: card.decoy, locationId: card.locationId,
      position: card.position, flipped: card.flipped, known: card.known,
    })),
  }
}

// 拟态克星：受伤 → 揭示一张迷你卡；诱饵取消全部伤害（保留在场上、正面朝上），
// 否则如常造成伤害，然后所有已揭示的迷你卡翻回并混洗。
function mimeticNemesisDamageShield(state, enemy, seat, source) {
  const candidates = concealedMiniCards(state).filter(card => !card.flipped)
  if (!candidates.length) return undefined
  // 该读点没有 api（引擎只传 state/enemy/source/seat），按确定性顺序取第一张（见近似披露）。
  const card = candidates[0]
  if (card.decoy === true) {
    revealMiniCardKeep(state, card.id)
    chapterState(state).nemesisShield = { round: Number(state.round) || 0, decoy: true, miniCardId: card.id }
    return false
  }
  revealMiniCardKeep(state, card.id)
  hideAllConcealed(state, { shuffle: true })
  chapterState(state).nemesisShield = { round: Number(state.round) || 0, decoy: false, miniCardId: card.id }
  void enemy
  void seat
  void source
  return undefined
}

function enemyTextBlanked(state, enemy) {
  const entry = registeredEntry(codeOf(enemy))
  return entry?.enemyRule?.textBlanked === true || enemy?.textBlanked === true
}

function isFightAgainstOutsider(state) {
  const test = state.skillTest
  if (!test) return false
  const target = test.target
  if (!target) return false
  const enemy = (state.enemies || []).find(item => item.id === (target.id || target))
  if (!enemy) return false
  return enemy.exhausted !== true
    && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'outsider')
}

function transdimensionalShock(state, inv, api) {
  const keys = api?.mechanics?.tsk?.keys
  const held = keys ? keys.heldBy({ type: 'investigator', seat: inv.seat }) : []
  const unstable = held.filter(id => {
    try { return keys.get(id)?.stable === false } catch { return false }
  })
  const stable = held.filter(id => {
    try { return keys.get(id)?.stable === true } catch { return false }
  })
  const options = [{ id: 'none', label: '不取消（受到 2 点伤害与 2 点恐惧）' }]
  if (unstable.length) options.push({ id: 'unstable', label: '变换一个动荡钥匙（不翻面）：取消全部伤害与恐惧' })
  if (stable.length) options.push({ id: 'stable', label: `翻稳定钥匙取消等量伤害/恐惧（最多 ${stable.length} 点）` })
  const answer = options.length === 1 ? 'none' : choiceFor(api, {
    kind: 'choice', source: 'agenda2', seat: inv.seat, prompt: '跨维震撼：可以取消本次伤害与恐惧。', options,
  }) || 'none'
  let damage = 2
  let horror = 2
  if (answer === 'unstable' && unstable.length) {
    try {
      keys.shift(unstable[0], { force: true })
      damage = 0
      horror = 0
      infoOf(api, `🔑 ${inv.name} 变换「${unstable[0]}」取消全部伤害与恐惧。`)
    } catch { /* 保留伤害 */ }
  } else if (answer === 'stable' && stable.length) {
    const amount = Math.min(stable.length, 2)
    for (const id of stable.slice(0, amount)) {
      try {
        keys.shift(id, { force: true })
      } catch { /* 已变换 */ }
    }
    damage = Math.max(0, damage - amount)
    horror = Math.max(0, horror - amount)
    infoOf(api, `🔑 ${inv.name} 翻 ${amount} 把稳定钥匙，取消 ${amount} 点伤害/恐惧。`)
  }
  if (damage || horror) {
    if (typeof api?.harm === 'function') api.harm(inv.seat, { damage, horror })
    else {
      inv.damage = (Number(inv.damage) || 0) + damage
      inv.horror = (Number(inv.horror) || 0) + horror
    }
  }
  return { answer, damage, horror }
}

export const implementedEncounterCodes = behavior.implementedEncounterCodes
export const entryCodes = () => [...implementedEncounterCodes]
export default behavior
