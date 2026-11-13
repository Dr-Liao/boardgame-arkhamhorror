// 如履薄冰（On Thin Ice · 09609 · 安克雷奇）· 引擎钩子（荒野追踪 + 虚空奇美拉分裂形态 + 空洞化 + 密钥）。
//
// 约定（与 EotE / TDE / 同循环各章 behavior 相同）：
//   · 逐卡规则写在单卡条目（enemyRule / assetRule / keyRule / encounterResolve）里，behavior 只做分派；
//   · 内容层（behavior）可以读写 state；卡条目只能通过 `ctx.api`（R1）；
//   · 隐匿迷你卡统一走 P2 原语 `src/engine/tsk-concealed.js`；空洞走 `src/engine/tsk-hollow.js`；
//     绯红密钥走 `src/engine/tsk-scarlet-keys.js`（入口 `api.mechanics.tsk.*`）。
//
// 本章机械（参考 `Scenarios/TheScarletKeys/OnThinIce.hs` 与各卡实现）：
//   1. 布置：安克雷奇/费尔班克斯入场；三张阿拉斯加荒地背面朝上；三张界外荒地放在一边；
//      索恩两面、五张虚空奇美拉、玄丧之镜放在一边；按战役日志 time/5 给密谋 1 加毁灭。
//   2. 幕 1 背面「幕后交易」：按当前密谋与玩家选择走 Raw Deal 3/4/5（记录、混乱袋、索恩版本、钥匙归属）。
//   3. 幕 2 背面：真实形态进入阴影并结算「隐匿 4」（4 张具名诱饵 + 真身，平均分到[[荒地]]地点）。
//   4. 幕 3 背面：域外来客之巢入场、与揭露地点单向连接、真实形态与调查员被拖进巢穴。
//   5. 幕 4 背面「绝杀一击」：按场上索恩是剧情支援/敌人/不在场分流 R1/R2/R3。
//   6. 密谋 1/2 背面：每位调查员把一个[[盟友]]/[[道具]]支援或同名手牌放在一边作为空洞。
//   7. 密谋 3 背面「灭绝」：收齐空洞，每位调查员放逐自己经验值费用最高的空洞 → R4（本场冒险从未发生）。
import { exposeWithReaction } from '../../concealed.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { isPendingChoice } from '../../../../../src/engine/resolution.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import {
  assetRuleFor, enemyRuleFor, encounterResolveFor, resolveDeclarativeTreacheryTest, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import {
  concealedAt, concealedMiniCards, distributeConcealed, exposeMiniCard,
} from '../../../../../src/engine/tsk-concealed.js'
import { hollowCards, hollowCount } from '../../../../../src/engine/tsk-hollow.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  CHAPTER_ID, CONCEALED_AMOUNT, DECOY_KINDS, GATHER_GROUPS, LOCATIONS, OUTER_WILDERNESS_LOCATION_IDS,
  OUTSIDERS_LAIR, RAW_CODES, RAW_DEAL, RECORD_KEYS, RECORD_READS, RECORD_WRITES, SABLE_GLASS_KEY,
  SET_ASIDE_CODES, SET_ASIDE_LOCATION_IDS, START_LOCATION, TRUE_FORM_MINI, VOID_CHIMERA_FORM_CODES,
  WILDERNESS_LOCATION_IDS, acts, agendas, clueValueOf, resolutions, wildernessInPlay,
} from './definition.js'
import {
  ON_THIN_ICE_TOKEN_MEANINGS, TRUE_FORM_CODE, cardNameOf, hazardTreacheriesInPlay, miniKindLabel,
  onThinIceAfterTest, onThinIceChaosToken, voidChimeraAtLocation,
} from './chaos.js'

const CHAPTER_STATE_VERSION = 1
const STATE_KEY = 'onThinIce'
const LEAD_SEAT = state => Number(state?.campaign?.leadSeat ?? state?.currentSeat ?? 0)

export const scenarioApproximations = Object.freeze([
  '「三张阿拉斯加荒地洗混背面朝上」用未揭示面（隐藏名称 + 背面符号 + hiddenIdentity）表达：'
    + '三张卡的身份对玩家不可见（名字显示为「阿拉斯加荒地」、连接按 Triangle 只连费尔班克斯），'
    + '但它们在桌面上的坐标按卡号固定（参考实现是玩家自己把三张卡洗混后放进三个空槽）。',
  '勘察报告（幕 2 正面行动）用地点上的布尔记账（`chapter.scoutingReports`）近似，'
    + '因为引擎没有「地点上的通用资源标记」原语（已登记原语请求 new.locationResourceMarker）；'
    + '「每个[[荒地]]地点仅限 1 个」由同一张表保证。',
  '「尽可能平均分发」在张数除不尽时按地点顺序补足（参考实现让领队选择多出的 1 张）；确定性顺序便于重放。',
  '揭露迷你卡按规则可以在调查/攻击/躲避中顺带进行；本章实现为独立的剧本行动（1 行动），'
    + '避免在每个基础行动里重复写窗口（与《血色阴影》同一口径）。',
  '玄丧之镜「查看已揭示面」用迷你卡的 `known` 标记（观察投影的 same 读点，不翻面、不揭露）。',
  '密谋 3 的「本场冒险中从游戏移除的空洞」用「当前空洞区 + 本章记录的被抹除卡号」近似：'
    + '引擎没有独立的「本场冒险移出场外的卡」集合（空洞原语 `erase` 直接写战役抹除名单）。',
  '索恩（剧情支援）的「横置后让该调查员立即行动」由 `api.beginImmediateAction` 结算；'
    + '「每次有人把卡放在一边作为空洞之后」由本章的空洞写入点统一派发（没有新的引擎窗口）。',
  '结局 4「本场冒险从未发生」按参考实现恢复开场快照的创伤与经验（`chapter.progressSnapshot`），'
    + '并 `award:false` 跳过经验结算；混乱袋/牌组不回溯（参考实现也不回溯牌组状态）。',
])

export const scenarioGaps = Object.freeze([
  '共享遭遇组（域外使节/尤格斯的代理人/深红密谋/黑暗笼罩/环球漫游/域外来客/红色同志会/空间异常）的卡牌行为属于共享组，'
    + '本章只声明 requiredEncounterGroupIds；`Chilling Cold`（刺骨严寒）是核心复用组，按战役层的'
    + 'EXTERNAL_ENCOUNTER_DEPENDENCIES 登记，不在本循环的 TSK 组清单里。',
  '指南「幕间故事：强买强卖（Raw Deal）」的正文由指南层展示；本章只结算它的分支效果。',
  '世界地图的时间阈值（状况报告 α–ω）与启程循环由战役流程层结算；本章只累加 time 记录。',
])

// ---------------------------------------------------------------------------
// 基础读点
// ---------------------------------------------------------------------------
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const aliveInvestigators = state => (state?.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const enemyOf = (state, code) => (state?.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === code) || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const recordFact = (state, key, value = true) => {
  const records = recordsFor(state)
  if (value === false) delete records[key]
  else records[key] = value
  return records[key]
}
const hasRecord = (state, key) => recordsFor(state)[key] === true || recordsFor(state)[key] === 'true'
const locationName = (state, id) => LOCATIONS[id]?.name || locationOf(state, id)?.name || String(id || '')
const isWilderness = location =>
  (location?.traits || []).some(trait => String(trait).toLowerCase() === 'wilderness')
const isHazardCode = code =>
  (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'hazard')
const hasTrait = (card, trait) =>
  (card?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())

function choiceFor(api, request) {
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

function shuffleWith(state, list, helper) {
  if (typeof helper?.shuffle === 'function') return helper.shuffle([...list], () => helper.randomValue(state))
  const copy = [...list]
  const random = typeof helper?.random === 'function' ? helper.random : () => randomValue(state)
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// 章节状态（纯 JSON，随存档往返）
// ---------------------------------------------------------------------------
export function chapterState(state) {
  const flags = (state.scenarioFlags ||= {})
  const data = flags[STATE_KEY] ||= {}
  data.version ||= CHAPTER_STATE_VERSION
  data.scoutingReports ||= {}
  data.wildernessOrder ||= []
  data.decoyExposed ||= 0
  if (data.exposedLocation === undefined) data.exposedLocation = null
  if (data.trueFormDefeated == null) data.trueFormDefeated = false
  if (data.thorneVersion == null) data.thorneVersion = null
  if (data.rawDeal == null) data.rawDeal = null
  data.hollowed ||= []
  return data
}

export const scoutingReportCount = (state, locationId) =>
  Number(chapterState(state).scoutingReports?.[locationId]) || 0

export function markTime(state, amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  if (!value) return 0
  const records = recordsFor(state)
  records[RECORD_KEYS.time] = (Number(records[RECORD_KEYS.time]) || 0) + value
  const map = state.campaign?.tsk?.map
  if (map) map.time = Number(records[RECORD_KEYS.time])
  return records[RECORD_KEYS.time]
}

/** 开场快照：结局 4「本场冒险从未发生」要把创伤与经验恢复到这里（参考实现 OnThinIceMeta）。 */
export function snapshotProgress(state) {
  const data = chapterState(state)
  if (Array.isArray(data.progressSnapshot) && data.progressSnapshot.length) return data.progressSnapshot
  data.progressSnapshot = (state.investigators || []).map(inv => ({
    seat: inv.seat,
    physical: Number(state.campaign?.trauma?.[inv.seat]?.physical) || 0,
    mental: Number(state.campaign?.trauma?.[inv.seat]?.mental) || 0,
    xp: Number(state.campaign?.investigators?.[inv.seat]?.xp) || 0,
  }))
  return data.progressSnapshot
}

export function restoreProgress(state, api = null) {
  const snapshot = state?.scenarioFlags?.[STATE_KEY]?.progressSnapshot || []
  for (const entry of snapshot) {
    const trauma = (state.campaign.trauma ||= {})
    trauma[entry.seat] ||= { physical: 0, mental: 0 }
    trauma[entry.seat].physical = entry.physical
    trauma[entry.seat].mental = entry.mental
    const record = state.campaign?.investigators?.[entry.seat]
    if (record) record.xp = entry.xp
  }
  api?.info?.(`🌀 结局 4：本场冒险从未发生 —— ${snapshot.length} 位调查员的创伤与经验恢复开场快照。`)
  return snapshot.length
}

// ---------------------------------------------------------------------------
// 绯红密钥（玄丧之镜）
// ---------------------------------------------------------------------------
/** 登记玄丧之镜（战役级 `campaign.tsk.keys`；已登记其它钥匙时只读）。 */
export function ensureSableGlassKey(state, api = null) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys) return false
  try {
    keys.get(SABLE_GLASS_KEY.id)
    return true
  } catch {
    /* 未登记，下面尝试初始化 */
  }
  try {
    if ((keys.all() || []).length) return false
    // 密钥原语只接受 `{ id, stableFace, unstableFace, bearer? }`（未知字段会整批拒绝）。
    keys.initialize([{
      id: SABLE_GLASS_KEY.id,
      stableFace: SABLE_GLASS_KEY.stableFace,
      unstableFace: SABLE_GLASS_KEY.unstableFace,
    }])
    return true
  } catch {
    return false
  }
}

/** 当前面的变换声明（条目 `assetRule.keyShift`）；密钥未登记或该面没有条目时返回 null。 */
export function keyShiftRule(state, api) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys) return null
  let cardFace = null
  try {
    cardFace = keys.face(SABLE_GLASS_KEY.id)
  } catch {
    return null
  }
  const rule = registeredEntry(cardFace)?.assetRule?.keyShift
  if (!rule) return null
  return { cardFace, keyId: rule.keyId || SABLE_GLASS_KEY.id, face: rule.face || null, shift: rule }
}

/**
 * 结算一次「变换」（内容层唯一执行点）：按当前面的 keyRule.shift 结算效果，再翻面。
 * `by`: 'investigator'（调查员变换：稳定面 → 动荡面；动荡面在调查员变换后翻回稳定面）|
 *       'enemy'（敌人身上的钥匙只结算效果，不翻回稳定面，也不受「每轮一次」限制）。
 */
export function resolveKeyShift(state, seat, api, { by = 'investigator' } = {}) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys) return null
  const rule = keyShiftRule(state, api)
  if (!rule) return null
  const shift = rule.shift
  const effect = shift.effect || {}
  if (effect.kind === 'lookAtConcealedAtLocation') {
    const here = concealedAt(state, state.investigators?.[seat]?.location)
    for (const card of here) markMiniKnown(state, card.id)
    api?.info?.(`🔍 玄丧之镜（稳定面）：查看「${locationName(state, state.investigators?.[seat]?.location)}」`
      + `${here.length} 张迷你卡的已揭示面（不揭露）。`)
  } else if (effect.kind === 'hollowHighestCostInHand') {
    const hollowed = []
    for (const inv of aliveInvestigators(state)) {
      const code = highestCostHandCard(inv)
      if (!code) continue
      const result = hollowFromHand(state, inv.seat, api, { code, source: SABLE_GLASS_KEY.id })
      if (result) hollowed.push(result.code)
    }
    api?.info?.(`🪞 玄丧之镜（动荡面）：${hollowed.length} 位调查员把手中印刷费用最高的非弱点卡放在一边作为空洞。`)
  }
  const flipped = by === 'investigator' || shift.flip === 'always'
  if (flipped) {
    try {
      keys.shift(SABLE_GLASS_KEY.id, { force: by === 'enemy' })
    } catch (error) {
      api?.info?.(`玄丧之镜翻面失败：${error.message}`)
    }
  }
  return { face: rule.face || null, cardFace: rule.cardFace, effect: effect.kind || null, flipped }
}

function highestCostHandCard(inv) {
  const candidates = (inv?.hand || []).filter(code => !isWeakness(code))
  if (!candidates.length) return null
  return [...candidates].sort((left, right) =>
    (Number(ALL_CARDS[right]?.cost) || 0) - (Number(ALL_CARDS[left]?.cost) || 0)
    || String(left).localeCompare(String(right)))[0]
}
const isWeakness = code => (ALL_CARDS[code]?.subtype === 'weakness' || ALL_CARDS[code]?.subtype === 'basicweakness')

/** 敌人（索恩）被击败时把玄丧之镜交给任意调查员；没有调查员可控时留在索恩身上。 */
export function transferSableGlassFromEnemy(state, api) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys) return null
  const alive = aliveInvestigators(state)
  if (!alive.length) return null
  const answer = alive.length === 1 ? String(alive[0].seat) : choiceFor(api, {
    kind: 'story', source: RAW_CODES.thorneEnemy, seat: alive[0].seat,
    prompt: '索恩被击败：玄丧之镜附属到哪位调查员？',
    options: alive.map(inv => ({ id: String(inv.seat), label: inv.name || `调查员${inv.seat + 1}` })),
  })
  const seat = alive.some(inv => String(inv.seat) === String(answer)) ? Number(answer) : alive[0].seat
  try {
    keys.bind(SABLE_GLASS_KEY.id, { type: 'investigator', seat })
  } catch {
    return null
  }
  api.info?.(`🔑 玄丧之镜改由 ${state.investigators?.[seat]?.name || '调查员'} 持有。`)
  return seat
}

// ---------------------------------------------------------------------------
// 空洞（Hollow）
// ---------------------------------------------------------------------------
const hollowApi = api => api?.mechanics?.tsk?.hollow || null

/** 空洞总数（team）/ 某座位（investigator）；原语不可用时按 0。 */
export function hollowCountOf(state, seat = null) {
  if (seat == null) return hollowCards(state).length
  return hollowCards(state).filter(card => card.scope === 'team' || card.seat === seat).length
}

function recordHollow(state, entry) {
  const data = chapterState(state)
  data.hollowed.push({ ...entry, round: Number(state.round) || 1 })
  syncFellhoundKeywords(state)
  return entry
}

/**
 * 凶狠猎犬（09630）：「你攻击或躲避它时，如果你有放在一边的空洞，它获得警戒和反击」。
 * 引擎没有战斗进行中的关键词授予读点，因此按「空洞区非空期间」近似（见条目 note）：
 * 空洞写入/回收后重算一次该敌人的实例关键字。
 */
export function syncFellhoundKeywords(state) {
  const hollows = hollowCards(state)
  for (const enemy of state?.enemies || []) {
    if (!enemyRuleFor(codeOf(enemy))?.gainsAlertRetaliateWhileHollowsOwned) continue
    const owned = hollows.some(card => card.scope === 'team'
      || (enemy.engagedSeat != null ? card.seat === enemy.engagedSeat : true))
    enemy.alert = owned
    enemy.retaliate = owned
  }
}

/**
 * 把一张手牌放在一边作为空洞（scope 按卡面：本章个人口径 = investigator + 该座位）。
 * 写入顺序：先从手牌移除，再经原语登记（原语拒绝重复卡号，因此同一张牌不会二次入空洞区）。
 */
export function hollowFromHand(state, seat, api, { code = null, source = 'hollow' } = {}) {
  const inv = state.investigators?.[seat]
  if (!inv) return null
  const hand = inv.hand || []
  const candidates = hand.filter(item => !isWeakness(item))
  if (!candidates.length) return null
  let chosen = code && candidates.includes(code) ? code : null
  if (!chosen) {
    chosen = candidates.length === 1 ? candidates[0] : choiceFor(api, {
      kind: 'card', source, seat,
      prompt: '选择你手中一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。',
      options: candidates.map(item => ({ id: item, cardCode: item, label: cardNameOf(item) })),
    })
    if (!candidates.includes(chosen)) chosen = candidates[0]
  }
  const hollow = hollowApi(api)
  if (!hollow) return null
  inv.hand = hand.filter((item, index) => item !== chosen || index !== hand.indexOf(chosen))
  try {
    hollow.hollow({ code: chosen, source, scope: 'investigator', seat })
  } catch {
    // 原语拒绝（重复卡号等）：回滚手牌。
    inv.hand.push(chosen)
    return null
  }
  recordHollow(state, { code: chosen, seat, source })
  api?.info?.(`🕳️ ${inv.name || '调查员'} 把「${cardNameOf(chosen)}」放在一边作为空洞。`)
  maybeThorneReaction(state, seat, api)
  return { code: chosen, seat, scope: 'investigator' }
}

/** 查看牌库顶一张：不是弱点就放在一边作为空洞（牌库不洗、顺序不外泄）。 */
export function hollowFromDeckTop(state, seat, api, { source = 'deckTop' } = {}) {
  const inv = state.investigators?.[seat]
  const top = (inv?.deck || [])[inv.deck.length - 1]
  if (!top) return null
  if (isWeakness(top)) {
    api?.info?.(`🕳️ 牌库顶是弱点「${cardNameOf(top)}」：不放在一边作为空洞。`)
    return null
  }
  const hollow = hollowApi(api)
  if (!hollow) return null
  if (typeof api.takeDeckCard === 'function') api.takeDeckCard(seat, top)
  else inv.deck.pop()
  try {
    hollow.hollow({ code: top, source, scope: 'investigator', seat })
  } catch {
    return null
  }
  recordHollow(state, { code: top, seat, source })
  api?.info?.(`🕳️ 牌库顶的「${cardNameOf(top)}」被放在一边作为空洞。`)
  maybeThorneReaction(state, seat, api)
  return { code: top, seat, scope: 'investigator' }
}

/** 把一个在场的支援放在一边作为空洞（离场经 api.removeAsset，不伪造弃置）。 */
export function hollowAssetInPlay(state, seat, assetId, api, { source = 'asset' } = {}) {
  const inv = state.investigators?.[seat]
  const asset = (inv?.assets || []).find(item => String(item.id) === String(assetId))
  if (!asset) return null
  const code = codeOf(asset)
  const hollow = hollowApi(api)
  if (!hollow) return null
  try {
    hollow.hollow({ code, source, scope: 'investigator', seat })
  } catch {
    return null
  }
  if (typeof api.removeAsset === 'function') api.removeAsset(seat, asset.id)
  else inv.assets = inv.assets.filter(item => item !== asset)
  recordHollow(state, { code, seat, source })
  api?.info?.(`🕳️ ${inv.name || '调查员'} 的「${cardNameOf(code)}」被放在一边作为空洞。`)
  maybeThorneReaction(state, seat, api)
  return { code, seat, scope: 'investigator' }
}

/** 回收一张空洞：`to` = hand（安克雷奇的行动）/ deck / discard。 */
export function recallHollow(state, code, api, { to = 'hand', seat = null } = {}) {
  const hollow = hollowApi(api)
  if (!hollow) return null
  const entry = hollowCards(state).find(card => card.code === code)
  if (!entry) return null
  const recalled = hollow.recall(code, { to })
  if (!recalled) return null
  syncFellhoundKeywords(state)
  const owner = seat != null ? seat : entry.seat
  if (to === 'hand' && owner != null && typeof api.putInHand === 'function') api.putInHand(owner, code)
  else if (to === 'deck' && owner != null && typeof api.putOnDeckBottom === 'function') api.putOnDeckBottom(owner, code)
  api?.info?.(`♻️ 「${cardNameOf(code)}」从空洞回到${to === 'hand' ? '所有者手中' : to === 'deck' ? '牌库底' : '弃牌堆'}。`)
  return { ...recalled, owner }
}

/** 索恩（剧情支援 09625b）的反应：有人把卡放在一边作为空洞后，横置他让该调查员立即行动。 */
export function maybeThorneReaction(state, seat, api = null) {
  const rule = assetRuleFor(RAW_CODES.thorneAsset)?.onHollowSetAside
  if (!rule) return false
  const holders = (state.investigators || []).filter(inv => (inv.assets || [])
    .some(asset => codeOf(asset) === RAW_CODES.thorneAsset))
  if (!holders.length) return false
  const holder = holders[0]
  const asset = holder.assets.find(item => codeOf(item) === RAW_CODES.thorneAsset)
  const targetSeat = Number.isInteger(seat) ? seat : holder.seat
  const target = state.investigators?.[targetSeat]
  if (!target || target.defeated || target.resigned) return false
  if (asset.exhausted) {
    api?.info?.('🕳️ 索恩已横置：本次不触发「立即行动」的反应。')
    return false
  }
  if (rule.exhaustSelf !== false) asset.exhausted = true
  api?.info?.(`🎩 索恩：${target.name || '调查员'} 可以立即进行一次行动。`)
  if (rule.immediateAction && typeof api?.beginImmediateAction === 'function') {
    api.beginImmediateAction(targetSeat, { source: RAW_CODES.thorneAsset })
  }
  return true
}

// ---------------------------------------------------------------------------
// 隐藏迷你卡（隐匿 4：4 张具名诱饵 + 真身）
// ---------------------------------------------------------------------------
export const concealedAmountOf = code => {
  const declared = enemyRuleFor(code)?.concealed
  if (declared != null) return Number(declared) || 0
  return code === TRUE_FORM_CODE ? CONCEALED_AMOUNT : 0
}

export const miniCardsAt = (state, locationId) =>
  concealedMiniCards(state).filter(card => card.locationId === locationId)

/** 迷你卡的候选地点：在场的[[荒地]]地点（剧本修正：非荒地地点不放迷你卡）。 */
export function concealedSpots(state) {
  const spots = wildernessInPlay(state)
  if (spots.length) return spots
  return (state.locations || []).filter(isWilderness).map(location => location.id)
}

/** 尽可能平均地把迷你卡分到地点；除不尽时多出的按地点顺序补足。 */
export function evenPlacements(cards, locationIds) {
  const ids = [...new Set(locationIds)]
  if (!ids.length) return []
  const placements = ids.map(locationId => ({ locationId, count: 0 }))
  cards.forEach((_, index) => { placements[index % ids.length].count += 1 })
  return placements.filter(entry => entry.count > 0)
}

/** 结算「隐匿 4」：真身迷你卡 + 4 张具名诱饵，混洗后平均分到[[荒地]]地点。 */
export function resolveTrueFormConcealed(state, { locations = null, shuffle = null } = {}) {
  const amount = concealedAmountOf(TRUE_FORM_CODE)
  if (!amount) return []
  const spots = locations && locations.length ? locations : concealedSpots(state)
  if (!spots.length) return []
  const cards = [{ kind: TRUE_FORM_MINI, code: TRUE_FORM_CODE, decoy: false },
    ...Object.keys(DECOY_KINDS).map(kind => ({ kind, decoy: true }))]
  const placements = evenPlacements(cards, spots)
  const created = distributeConcealed(state, { cards, placements, position: null, ...(shuffle ? { shuffle } : {}) })
  chapterState(state).decoyExposed = Number(chapterState(state).decoyExposed) || 0
  return created
}

/** 真实形态进入阴影（幕 2 背面）：结算隐匿并把迷你卡放下。 */
export function enterShadows(state, api, options = {}) {
  const created = resolveTrueFormConcealed(state, options)
  api?.info?.(`🌫️ 虚空奇美拉（真实形态）进入阴影：${created.length} 张迷你卡（1 真身 + ${created.length - 1} 具名诱饵）`
    + `分到 ${new Set(created.map(card => card.locationId)).size} 个[[荒地]]地点。`)
  return created
}

/** 其它形态是否在场（09626：其它形态在场时不能揭露任何迷你卡）。 */
export function otherFormInPlay(state) {
  const trueFormMarker = enemyRuleFor(TRUE_FORM_CODE)
  if (!trueFormMarker?.blocksExposeWhileOtherFormsInPlay) return null
  return (state.enemies || []).find(enemy => !enemy.defeated
    && VOID_CHIMERA_FORM_CODES.includes(String(codeOf(enemy)))
    && codeOf(enemy) !== TRUE_FORM_CODE) || null
}

/** 揭露许可：返回 null 表示可以；否则返回拒绝文案（09626：其它形态在场时不能揭露任何迷你卡）。 */
export function exposeBlockedReason(state) {
  const other = otherFormInPlay(state)
  if (other) return `虚空奇美拉的其他形态「${other.name || codeOf(other)}」在场：不能揭露任何隐匿迷你卡。`
  return null
}

function markMiniKnown(state, id) {
  const container = state.scenarioFlags?.mechanics?.tsk?.concealed
  const record = container?.miniCards?.find(card => card.id === id)
  if (record) record.known = true
  return Boolean(record)
}

/** 揭露一张迷你卡：诱饵 → 生成对应分裂形态；真身 → 真实形态入场。 */
export function exposeAt(state, inv, miniCardId, api = null) {
  const blocked = exposeBlockedReason(state)
  if (blocked) {
    api?.info?.(`🚫 ${blocked}`)
    return null
  }
  const card = concealedMiniCards(state).find(item => item.id === miniCardId)
  if (!card) return null
  const locationId = card.locationId
  const result = exposeWithReaction(state, api, miniCardId, { seat: inv?.seat ?? null })
  const data = chapterState(state)
  if (result.decoy) {
    data.decoyExposed = (Number(data.decoyExposed) || 0) + 1
    const code = DECOY_KINDS[result.kind] || null
    const rule = enemyRuleFor(TRUE_FORM_CODE)?.decoySpawns || {}
    const target = rule[result.kind] || code
    let enemy = null
    if (target) {
      const aside = (state.setAsideEnemies || []).find(item => codeOf(item) === target)
      if (aside && typeof api?.restoreEnemyFromAside === 'function') enemy = api.restoreEnemyFromAside(aside.id, locationId)
      if (!enemy && typeof api?.spawn === 'function') enemy = api.spawn(target, locationId)
    }
    api?.info?.(`🔓 揭露了「${miniKindLabel(result.kind)}」的诱饵：`
      + `${target ? `「${cardNameOf(target)}」在「${locationName(state, locationId)}」生成。` : '没有对应的形态。'}`)
    return { ...result, locationId, enemyCode: target, enemyId: enemy?.id || null }
  }
  // 真身：真实形态放到该地点（优先从放一边取回，保证不产生第二份）。
  const aside = (state.setAsideEnemies || []).find(item => codeOf(item) === TRUE_FORM_CODE)
  let enemy = null
  if (aside && typeof api?.restoreEnemyFromAside === 'function') enemy = api.restoreEnemyFromAside(aside.id, locationId)
  if (!enemy && typeof api?.spawn === 'function') enemy = api.spawn(TRUE_FORM_CODE, locationId)
  data.exposedLocation = locationId
  api?.info?.(`🔓 揭露了虚空奇美拉的真身：它在「${locationName(state, locationId)}」现身。`)
  return { ...result, locationId, enemyCode: TRUE_FORM_CODE, enemyId: enemy?.id || null }
}

// ---------------------------------------------------------------------------
// 布置
// ---------------------------------------------------------------------------
/** 未揭示面的运行期变体：名字换成背面白身，揭示时 engine 用 unrevealedActualName 换回正面名。 */
function unrevealedVariant(state, id) {
  const definition = LOCATIONS[id]
  if (!definition?.unrevealed) return null
  return {
    name: definition.unrevealed.name,
    nameEn: definition.unrevealed.nameEn,
    hiddenIdentity: true,
    unrevealedActualName: definition.name,
    unrevealedActualNameEn: definition.nameEn,
    traits: [...(definition.unrevealed.traits || [])],
  }
}

function placeCity(state, api, id) {
  if (typeof api?.place === 'function') {
    api.place(id)
    if (id === 'fairbanks') api.reveal?.(id)
    return locationOf(state, id)
  }
  return null
}

function setAsideZones(state) {
  state.scenarioZones ||= {}
  const aside = new Set(state.scenarioZones.setAside || [])
  for (const code of SET_ASIDE_CODES) aside.add(code)
  for (const id of SET_ASIDE_LOCATION_IDS) aside.add(LOCATIONS[id].originalCode)
  state.scenarioZones.setAside = [...aside]
  state.scenarioZones.victory ||= []
  state.scenarioZones.removed ||= []
  state.setAsideEnemies ||= []
  return state.scenarioZones.setAside
}

/** 三张阿拉斯加荒地入场：背面朝上（洗混顺序记录在章节状态里，便于复盘）。 */
function placeWilderness(state, api, helper) {
  const order = shuffleWith(state, WILDERNESS_LOCATION_IDS, helper)
  chapterState(state).wildernessOrder = order
  const placed = []
  for (const id of order) {
    if (!LOCATIONS[id]) continue
    if (typeof api?.place === 'function') api.place(id)
    placed.push(id)
  }
  return placed
}

// ---------------------------------------------------------------------------
// 荒野追踪：地点揭示 / 进入 / 最后一个线索
// ---------------------------------------------------------------------------
function testChoice(api, inv, code, prompt, options) {
  const answer = choiceFor(api, { kind: 'choice', source: code, seat: inv?.seat ?? 0, prompt, options })
  return options.some(option => option.id === answer) ? answer : options[0].id
}

/** 山间溪流：进入后检定[智力]或[敏捷](1)，失败 1 点伤害。 */
function mountainStreamEnter(state, inv, api) {
  const skill = testChoice(api, inv, RAW_CODES.mountainStream, '山间溪流：检定[智力]或[敏捷](1)。',
    [{ id: 'intellect', label: '智力(1)' }, { id: 'agility', label: '敏捷(1)' }])
  api?.test?.(inv.seat, skill, 1, result => {
    if (result?.success) {
      api?.info?.(`🏞️ ${inv.name || '调查员'} 涉过山间溪流。`)
      return
    }
    api?.info?.(`🏞️ ${inv.name || '调查员'} 在溪流里失足：受到 1 点伤害。`)
    if (typeof api?.harm === 'function') api.harm(inv.seat, { damage: 1 })
    else if (typeof api?.damage === 'function') api.damage(inv.seat, 1)
  }, 0, { code: RAW_CODES.mountainStream, name: '山间溪流', action: 'forced' })
  return true
}

/** 猎人小屋揭示：检定[意志]或[智力](3)说服猎人，失败 1 点伤害。 */
function huntersLodgeReveal(state, inv, api) {
  const skill = testChoice(api, inv, RAW_CODES.huntersLodge, '猎人小屋：检定[意志]或[智力](3)说服猎人冷静下来。',
    [{ id: 'willpower', label: '意志(3)' }, { id: 'intellect', label: '智力(3)' }])
  api?.test?.(inv.seat, skill, 3, result => {
    if (result?.success) {
      api?.info?.('🏚️ 猎人小屋：猎人冷静下来，让开了路。')
      return
    }
    api?.info?.('🏚️ 猎人小屋：说服失败，受到 1 点伤害。')
    if (typeof api?.harm === 'function') api.harm(inv.seat, { damage: 1 })
    else if (typeof api?.damage === 'function') api.damage(inv.seat, 1)
  }, 0, { code: RAW_CODES.huntersLodge, name: '猎人小屋', action: 'forced' })
  return true
}

/** 山间溪流最后一个线索被发现的强制：三张界外荒地入场并与其相邻。 */
export function openOuterWilderness(state, api) {
  const data = chapterState(state)
  if (data.outerWildernessOpened) return []
  data.outerWildernessOpened = true
  const placed = []
  for (const id of OUTER_WILDERNESS_LOCATION_IDS) {
    if (locationOf(state, id)) continue
    if (typeof api?.place === 'function') api.place(id)
    placed.push(id)
  }
  // 印刷规则：与山间溪流相邻（未揭示面的 T 符号只连 Square；这里直接补上双向连线，
  // 与符号自动连线同一条边，重复时只保留一份）。
  const stream = locationOf(state, 'mountainStream')
  if (stream) {
    for (const id of placed) {
      const outer = locationOf(state, id)
      if (!outer) continue
      if (!stream.connections.includes(id)) stream.connections.push(id)
      if (!outer.connections.includes('mountainStream')) outer.connections.push('mountainStream')
    }
  }
  api?.info?.(`🌲 山间溪流的最后一个线索被发现：${placed.length} 张界外荒地地点入场。`)
  return placed
}

// ---------------------------------------------------------------------------
// 幕 / 密谋推进效果
// ---------------------------------------------------------------------------
function agendaCode(state) {
  return codeOf((state.agendas || [])[state.agendaIndex])
}
function actCode(state) {
  return codeOf((state.acts || [])[state.actIndex])
}

/** 混乱袋换标记（Raw Deal 3/4/5）：目标标记已有 4 个时改为每人 +1 经验。 */
function swapChaosToken(state, from, to, api = null) {
  const bag = Array.isArray(state.chaosBag) ? state.chaosBag : (state.chaosBag = [])
  if (bag.filter(token => token === to).length >= 4) {
    for (const inv of state.investigators || []) inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + 1
    api?.info?.(`混乱袋里已经有 4 个 ${to}：改为每位调查员取得 1 点经验值。`)
    return false
  }
  const index = bag.indexOf(from)
  if (index >= 0) bag.splice(index, 1)
  bag.push(to)
  return true
}

/** 把索恩的剧情支援面放进场（lead 控制）。 */
function putThorneAssetInPlay(state, api) {
  const lead = LEAD_SEAT(state)
  const owner = state.investigators?.[lead]
  if (!owner) return null
  owner.assets ||= []
  const existing = owner.assets.find(asset => codeOf(asset) === RAW_CODES.thorneAsset)
  if (existing) {
    chapterState(state).thorneVersion = 'asset'
    return existing
  }
  const card = ALL_CARDS[RAW_CODES.thorneAsset]
  const asset = {
    id: `asset${RAW_CODES.thorneAsset}-${owner.seat}-${owner.assets.length + 1}`,
    code: RAW_CODES.thorneAsset, originalCode: RAW_CODES.thorneAsset,
    name: card?.nameZh || card?.name || '索恩', exhausted: false, damage: 0, horror: 0, uses: 0,
    slots: ['ally'], traits: [...(card?.traits || [])],
  }
  owner.assets.push(asset)
  chapterState(state).thorneVersion = 'asset'
  api?.info?.('🎩 索恩（剧情支援）进入游戏，由领队控制。')
  return asset
}

function attachSableGlassTo(state, bearer, api) {
  const keys = api?.mechanics?.tsk?.keys
  if (!keys || !bearer) return false
  try {
    keys.bind(SABLE_GLASS_KEY.id, bearer)
    return true
  } catch {
    return false
  }
}

/** 幕 1 背面「幕后交易」：按当前密谋与玩家选择分流 Raw Deal 3/4/5。 */
export function resolveRawDeal(state, api) {
  const data = chapterState(state)
  if (data.rawDeal) return data.rawDeal
  const firstAgenda = agendaCode(state) === RAW_CODES.agenda1
  const labels = RAW_DEAL.labels
  const options = firstAgenda
    ? [{ id: 'deal', label: labels.deal }, { id: 'refuse', label: labels.refuse }]
    : [{ id: 'deal', label: labels.deal }, { id: 'seize', label: labels.seize }]
  const answer = choiceFor(api, {
    kind: 'story', source: RAW_CODES.act1, seat: LEAD_SEAT(state),
    prompt: RAW_DEAL.checkAgenda || '幕后交易：你们要不要跟索恩合作？',
    options,
  })
  const branch = options.some(option => option.id === answer) ? answer : 'deal'
  data.rawDeal = branch
  if (branch === 'deal') {
    recordFact(state, RECORD_KEYS.dealWithThorne, true)
    swapChaosToken(state, 'elderthing', 'tablet', api)
    putThorneAssetInPlay(state, api)
    // 玄丧之镜附属到索恩（剧情支援）。引擎的密钥持有者只有 none/investigator/enemy 三种，
    // 因此按「领队控制索恩」记成领队的调查员持有，并在战役记录里标明真实持有者是索恩。
    attachSableGlassTo(state, { type: 'investigator', seat: LEAD_SEAT(state) }, api)
    recordsFor(state).keysSableGlassBearer = 'thorne'
    api.info?.('🤝 团队与索恩达成交易（战役日志：theCellMadeADealWithThorne）：玄丧之镜附属到索恩（稳定面）。')
    api.info?.(RAW_DEAL.stories.deal3)
    removeCrimsonConspiracyFromGame(state, api)
  } else if (branch === 'refuse') {
    swapChaosToken(state, 'tablet', 'elderthing', api)
    attachSableGlassTo(state, { type: 'investigator', seat: LEAD_SEAT(state) }, api)
    spawnThorneEnemy(state, api)
    api.info?.('🚫 团队拒绝合作：玄丧之镜由领队控制，索恩（敌人）在山间溪流现身。')
    api.info?.(RAW_DEAL.stories.deal4)
  } else {
    swapChaosToken(state, 'tablet', 'elderthing', api)
    const enemy = spawnThorneEnemy(state, api)
    if (enemy) attachSableGlassTo(state, { type: 'enemy', enemyId: enemy.id }, api)
    api.info?.('⚔️ 团队强夺失败：索恩（敌人）带着玄丧之镜（动荡面）在山间溪流现身。')
    api.info?.(RAW_DEAL.stories.deal5)
  }
  return branch
}

function spawnThorneEnemy(state, api) {
  const locationId = 'mountainStream'
  let enemy = null
  if (typeof api?.spawn === 'function') enemy = api.spawn(RAW_CODES.thorneEnemy, locationId)
  if (enemy) chapterState(state).thorneVersion = 'enemy'
  return enemy
}

/** Raw Deal 3：把[[深红密谋]]遭遇组的所有副本移出游戏。 */
function removeCrimsonConspiracyFromGame(state, api) {
  const codes = Object.keys(ALL_CARDS).filter(code => ALL_CARDS[code].encounterCode === 'crimson_conspiracy')
  if (!codes.length) return 0
  const isConspiracy = code => codes.includes(code)
  const before = (state.encounterDeck || []).length
  state.encounterDeck = (state.encounterDeck || []).filter(code => !isConspiracy(code))
  state.encounterDiscard = (state.encounterDiscard || []).filter(code => !isConspiracy(code))
  const removed = (state.removedFromGame ||= [])
  for (const code of codes) if (!removed.includes(code)) removed.push(code)
  api?.info?.(`🔥 把「深红密谋」遭遇组移出游戏（遭遇牌库 -${before - state.encounterDeck.length} 张）。`)
  return codes.length
}

/** 幕 2 背面：真实形态进入阴影，结算隐匿；有勘察报告的地点可以查看刚放下的迷你卡已揭示面。 */
export function revealTrueForm(state, api) {
  const created = enterShadows(state, api)
  const reports = chapterState(state).scoutingReports || {}
  const looked = []
  for (const card of created) {
    if (!reports[card.locationId]) continue
    markMiniKnown(state, card.id)
    looked.push(card.id)
  }
  if (looked.length) {
    api?.info?.(`🔭 ${looked.length} 个有勘察报告的地点：查看了刚放下的迷你卡已揭示面。`)
  }
  return { created, looked }
}

/** 幕 3 背面：域外来客之巢入场、与揭露地点单向连接、真实形态与调查员被拖进去。 */
export function enterOutsidersLair(state, api) {
  const data = chapterState(state)
  const exposedLocation = data.exposedLocation
    || (state.enemies || []).find(enemy => codeOf(enemy) === TRUE_FORM_CODE)?.location
    || null
  if (typeof api?.place === 'function' && !locationOf(state, OUTSIDERS_LAIR)) api.place(OUTSIDERS_LAIR)
  const lair = locationOf(state, OUTSIDERS_LAIR)
  if (!lair) return null
  if (exposedLocation) {
    const from = locationOf(state, exposedLocation)
    if (from && !from.connections.includes(OUTSIDERS_LAIR)) from.connections.push(OUTSIDERS_LAIR)
    data.exposedLocation = exposedLocation
  }
  const trueForm = (state.enemies || []).find(enemy => !enemy.defeated && codeOf(enemy) === TRUE_FORM_CODE)
  if (trueForm) {
    if (typeof api?.moveEnemy === 'function') api.moveEnemy(trueForm, OUTSIDERS_LAIR)
    else trueForm.location = OUTSIDERS_LAIR
  }
  const origin = exposedLocation ? locationOf(state, exposedLocation) : null
  const movers = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned
    && (origin ? inv.location === origin.id : inv.location === OUTSIDERS_LAIR))
  for (const inv of movers) {
    if (typeof api?.moveInvestigator === 'function') api.moveInvestigator(inv.seat, OUTSIDERS_LAIR)
    else inv.location = OUTSIDERS_LAIR
  }
  api?.info?.(`🕳️ 域外来客之巢入场：真实形态与 ${movers.length} 位调查员被拖进巢穴`
    + `${origin ? `（揭露地点「${origin.name}」与巢穴单向相连）` : ''}。`)
  return lair
}

function thorneInPlay(state) {
  const asset = (state.investigators || []).some(inv => (inv.assets || []).some(item => codeOf(item) === RAW_CODES.thorneAsset))
  if (asset) return 'asset'
  if (enemyOf(state, RAW_CODES.thorneEnemy)) return 'enemy'
  return null
}

// ---------------------------------------------------------------------------
// 遭遇卡分派
// ---------------------------------------------------------------------------
export function resolveEncounter(state, inv, card, api) {
  const code = codeOf(card)
  const entryResolve = encounterResolveFor(code)
  if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv?.location) })
  const declarative = treacheryTestFor(code)
  if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
  return false
}

// ---------------------------------------------------------------------------
// 剧本行动
// ---------------------------------------------------------------------------
export const ACTION_RULES = Object.freeze({
  expose: 'expose',
  hollowRecall: 'hollowRecall',
  mineGamble: 'mineGamble',
  outpostDraw: 'outpostDraw',
  scoutingReport: 'scoutingReport',
})

function hollowRecallAvailable(state, inv) {
  if (!hollowCards(state).length) return '空洞区没有卡'
  const data = chapterState(state)
  if (data.hollowRecalledRound === state.round && data.hollowRecalledSeat === inv.seat) return '本回合已经抽过空洞'
  return null
}

function mineGambleAction(state, inv, api) {
  const location = locationOf(state, inv.location)
  if (!location) return false
  const depletion = Number(location.depletion) || 0
  const bag = Array.isArray(state.chaosBag) ? state.chaosBag : []
  const draws = 1 + depletion
  const tokens = []
  const pool = bag.length ? bag : ['0']
  for (let index = 0; index < draws; index += 1) {
    const pick = pool[Math.min(pool.length - 1, Math.floor(randomValue(state) * pool.length))]
    tokens.push(pick)
  }
  const bad = tokens.some(token => ['skull', 'cultist', 'tablet', 'elderthing'].includes(token))
  if (bad) {
    api?.info?.(`⛏️ 废弃金矿：揭示了 ${tokens.join('、')} —— 触到符号，什么也没找到。`)
    return true
  }
  if (typeof api?.gainResources === 'function') api.gainResources(inv.seat, 4)
  else inv.resources = (Number(inv.resources) || 0) + 4
  location.depletion = depletion + 1
  api?.info?.(`⛏️ 废弃金矿：揭示了 ${tokens.join('、')} —— 获得 4 资源，并放下 1 个枯竭标记（共 ${location.depletion} 个）。`)
  return true
}

function outpostDrawAction(state, inv, api) {
  const data = chapterState(state)
  const key = `${RAW_CODES.forgottenOutpost}:${inv.seat}`
  if (data.outpostUsed?.[key]) {
    api?.info?.('🏚️ 被遗忘的哨站：本场冒险已经用过这个行动。')
    return false
  }
  data.outpostUsed ||= {}
  data.outpostUsed[key] = true
  if (typeof api?.drawCards === 'function') api.drawCards(inv.seat, 3)
  api?.info?.(`🏚️ 被遗忘的哨站：${inv.name || '调查员'} 抽取 3 张卡牌。`)
  return true
}

function scoutingReportAction(state, inv, api, move) {
  const location = locationOf(state, inv.location)
  if (!isWilderness(location)) return false
  if (scoutingReportCount(state, inv.location) > 0) return false
  const required = Math.max(1, Number(state.numInvestigators) || 1)
  const answer = typeof api?.payGroupClues === 'function'
    ? api.payGroupClues(required, { atLocation: inv.location })
    : null
  if (answer === false || answer === null) {
    // 没有 api.payGroupClues 时按「同地点调查员共同支付」的简化路径扣线索。
    const group = aliveInvestigators(state).filter(other => other.location === inv.location)
    const total = group.reduce((sum, other) => sum + (Number(other.clues) || 0), 0)
    if (total < required) return false
    let left = required
    for (const other of group) {
      const spend = Math.min(left, Number(other.clues) || 0)
      other.clues -= spend
      left -= spend
      if (!left) break
    }
  }
  chapterState(state).scoutingReports[inv.location] = 1
  api?.info?.(`🗺️ 「${locationName(state, inv.location)}」放置 1 个勘察报告。`)
  void move
  return true
}

function exposeMiniAction(state, inv, api, move) {
  const id = String(move.miniCardId || '')
  if (!miniCardsAt(state, inv.location).some(card => card.id === id)) return false
  exposeAt(state, inv, id, api)
  return true
}

// ---------------------------------------------------------------------------
// 巡逻（凶残巨喙）：[[荒地]]地点中调查员最多的那个
// ---------------------------------------------------------------------------
function resolvePatrol(state, api, enemy) {
  const rule = enemyRuleFor(codeOf(enemy))?.patrol
  if (!rule) return null
  const candidates = wildernessInPlay(state)
  if (!candidates.length) return null
  const countAt = id => aliveInvestigators(state).filter(inv => inv.location === id).length
  const ranked = [...candidates].sort((left, right) => countAt(right) - countAt(left)
    || String(left).localeCompare(String(right)))
  const patrol = { kind: 'named', locationId: ranked[0] }
  if (rule.trait && rule.trait !== 'Wilderness') {
    const filtered = (state.locations || []).filter(hasTraitLocation(rule.trait)).map(item => item.id)
    if (filtered.length) patrol.locationId = filtered[0]
  }
  enemy.patrol = patrol
  const destination = api?.mechanics?.tsk?.patrol?.destination?.(enemy)
  if (!destination) return null
  if (typeof api?.moveEnemy === 'function') api.moveEnemy(enemy, destination)
  else enemy.location = destination
  api?.info?.(`🐾 「${enemy.name || '巡逻敌人'}」巡逻到「${locationName(state, destination)}」。`)
  return destination
}
const hasTraitLocation = trait => location =>
  (location?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())

// ---------------------------------------------------------------------------
// 行为（引擎钩子）
// ---------------------------------------------------------------------------
export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes: Object.freeze([
    RAW_CODES.thorneEnemy, RAW_CODES.thorneAsset, RAW_CODES.voidChimeraTrueForm,
    RAW_CODES.voidChimeraFellbeak, RAW_CODES.voidChimeraEarsplitter, RAW_CODES.voidChimeraGorefeaster,
    RAW_CODES.voidChimeraFellhound, RAW_CODES.ravenousGrizzly, RAW_CODES.crackingIce, RAW_CODES.snowslide,
    RAW_CODES.sableGlassStable, RAW_CODES.sableGlassUnstable,
  ]),
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: ON_THIN_ICE_TOKEN_MEANINGS,
  recordReads: RECORD_READS,
  recordWrites: RECORD_WRITES,
  resolutions: Object.keys(resolutions),
  gatherGroups: GATHER_GROUPS,

  // ---- 开场：时间带来的毁灭标记 + 结局 4 的进度快照 + 玄丧之镜登记 ----
  preScenarioSetup(state, events, api) {
    snapshotProgress(state)
    ensureSableGlassKey(state, api)
    const time = Number(recordsFor(state)[RECORD_KEYS.time]) || 0
    const doom = Math.floor(time / 5)
    if (doom > 0) {
      if (typeof api?.addDoom === 'function') api.addDoom(doom)
      else state.doom = (Number(state.doom) || 0) + doom
      api?.info?.(`⏳ 战役日志已记录 ${time} 点时间：密谋 1 上放置 ${doom} 个毁灭标记。`)
    }
    api?.info?.('🧊 如履薄冰：三张阿拉斯加荒地背面朝上入场，三张界外荒地与索恩/虚空奇美拉/玄丧之镜放在一边。')
  },

  // ---- 布置 ----
  setupLocations(state, events, helper = {}) {
    const api = helper.api || null
    behavior.preScenarioSetup(state, events, api)
    const data = chapterState(state)
    state.locationVariants ||= {}
    for (const id of [...WILDERNESS_LOCATION_IDS, ...OUTER_WILDERNESS_LOCATION_IDS]) {
      const variant = unrevealedVariant(state, id)
      if (variant) state.locationVariants[id] = variant
    }
    placeCity(state, api, 'anchorage')
    placeCity(state, api, 'fairbanks')
    const wilderness = placeWilderness(state, api, helper)
    setAsideZones(state)
    data.scoutingReports = {}
    data.outerWildernessOpened = false
    helper.info?.(state, events, `🏙️ 如履薄冰：安克雷奇与费尔班克斯入场；`
      + `${wilderness.length} 张阿拉斯加荒地背面朝上（${wilderness.map(id => LOCATIONS[id].unrevealed.name).join('、')}）；`
      + `${SET_ASIDE_LOCATION_IDS.length} 张界外荒地放在一边。`)
    return []
  },

  // ---- 混乱标记：X 依赖场上[[危险]]诡计数量、tablet 依赖虚空奇美拉位置 ----
  resolveChaosToken(state, inv, token) {
    return onThinIceChaosToken(state, inv, token)
  },

  // ---- 检定之后：cultist/elderthing 的空洞 + 冰封湖面的符号连带 ----
  afterTest(state, inv, result, api) {
    const riders = onThinIceAfterTest(state, inv, result)
    for (const rider of riders) {
      if (rider === 'hollowFromHand') hollowFromHand(state, inv.seat, api, { source: RAW_CODES.scenario })
      else if (rider === 'hollowFromDeckTop') hollowFromDeckTop(state, inv.seat, api, { source: RAW_CODES.scenario })
    }
    // 冰封湖面：本地点的调查员在检定中揭示符号后，弃 1 张手牌或受 1 点恐惧。
    const here = locationOf(state, inv?.location)
    if (here && codeOf(here) === RAW_CODES.frozenLake) {
      const symbols = ['skull', 'cultist', 'tablet', 'elderthing']
      const revealed = (result?.drawn || []).some(token => symbols.includes(token))
      if (revealed) {
        const hand = (inv.hand || []).filter(code => !isWeakness(code))
        const answer = hand.length
          ? (choiceFor(api, {
            kind: 'choice', source: RAW_CODES.frozenLake, seat: inv.seat,
            prompt: '冰封湖面：弃掉 1 张手牌，或受到 1 点恐惧。',
            options: [{ id: 'horror', label: '受到 1 点恐惧' }, { id: 'discard', label: '弃掉 1 张手牌' }],
          }) || 'horror')
          : 'horror'
        if (answer === 'discard' && typeof api?.discardOneFromHand === 'function') {
          api.discardOneFromHand(inv.seat, { source: RAW_CODES.frozenLake })
        } else {
          api?.harm?.(inv.seat, { horror: 1 })
        }
        api?.info?.('🧊 冰封湖面：符号的寒意在检定后咬了你一口。')
      }
    }
    return riders
  },

  // ---- 地点：揭示 / 进入 / 线索 ----
  locationRevealed(state, location, api, seat) {
    const code = codeOf(location)
    if (code === RAW_CODES.huntersLodge) {
      const inv = seat != null ? state.investigators?.[seat] : aliveInvestigators(state)[0]
      if (inv) huntersLodgeReveal(state, inv, api)
    }
    return undefined
  },

  locationEntered(state, inv, destination, api) {
    const code = codeOf(destination)
    if (code === RAW_CODES.mountainStream) return mountainStreamEnter(state, inv, api)
    // 猎人小屋：[[怪物]]敌人进入时对它造成 1 点伤害（调查员进入不触发）。
    return undefined
  },

  cluesRemoved(state, location, amount, api) {
    if (codeOf(location) !== RAW_CODES.mountainStream) return
    if ((Number(location.clues) || 0) > 0) return
    if (!chapterState(state).outerWildernessOpened) openOuterWilderness(state, api)
    void amount
  },

  // ---- 地点能力 + 剧本行动 ----
  actions(state, inv) {
    const moves = []
    if (!inv) return moves
    const location = locationOf(state, inv.location)
    const blocked = exposeBlockedReason(state)
    for (const mini of miniCardsAt(state, inv.location)) {
      moves.push({
        action: 'scenarioAction', rule: `${ACTION_RULES.expose}:${mini.id}`, miniCardId: mini.id,
        locationId: inv.location, label: '揭露一张隐匿迷你卡（Expose）',
        ...(blocked ? { reason: blocked } : {}),
      })
    }
    const code = codeOf(location)
    if (code === RAW_CODES.anchorage) {
      const reason = hollowRecallAvailable(state, inv)
      moves.push({
        action: 'scenarioAction', rule: ACTION_RULES.hollowRecall, locationId: inv.location,
        label: '选择一个放在一边的空洞，让它的所有者抽回手中（每轮一次）',
        ...(reason ? { reason } : {}),
      })
    }
    if (code === RAW_CODES.condemnedGoldMine) {
      moves.push({
        action: 'scenarioAction', rule: ACTION_RULES.mineGamble, locationId: inv.location,
        label: `揭示 1+${Number(location?.depletion) || 0} 个混乱标记：没有符号就获得 4 资源并放下 1 个枯竭标记`,
      })
    }
    if (code === RAW_CODES.forgottenOutpost) {
      const used = chapterState(state).outpostUsed?.[`${RAW_CODES.forgottenOutpost}:${inv.seat}`]
      moves.push({
        action: 'scenarioAction', rule: ACTION_RULES.outpostDraw, locationId: inv.location,
        label: '抽取 3 张卡牌（每场游戏仅限一次）',
        ...(used ? { reason: '本场冒险已经用过这个行动', used: true } : {}),
      })
    }
    if (actCode(state) === RAW_CODES.act2 && isWilderness(location)) {
      const required = Math.max(1, Number(state.numInvestigators) || 1)
      const group = aliveInvestigators(state).filter(other => other.location === inv.location)
      const total = group.reduce((sum, other) => sum + (Number(other.clues) || 0), 0)
      const already = scoutingReportCount(state, inv.location) > 0
      moves.push({
        action: 'scenarioAction', rule: ACTION_RULES.scoutingReport, locationId: inv.location, required,
        label: `共同花费 ${required} 个线索：在「${locationName(state, inv.location)}」放置 1 个勘察报告`,
        ...(already ? { reason: '这个[[荒地]]地点已经有勘察报告了', used: true }
          : total < required ? { reason: `线索不足（需要 ${required}，本地点共有 ${total}）` } : {}),
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const rule = String(move?.rule || '')
    if (rule.startsWith(`${ACTION_RULES.expose}:`)) return exposeMiniAction(state, inv, api, move)
    if (rule === ACTION_RULES.hollowRecall) {
      const hollows = hollowCards(state)
      if (!hollows.length) return false
      const answer = hollows.length === 1 ? hollows[0].code : choiceFor(api, {
        kind: 'card', source: RAW_CODES.anchorage, seat: inv.seat,
        prompt: '安克雷奇：选择一个放在一边的空洞，它的所有者将其抽回手中。',
        options: hollows.map(card => ({ id: card.code, cardCode: card.code, label: cardNameOf(card.code) })),
      })
      const chosen = hollows.find(card => card.code === answer) || hollows[0]
      if (!chosen) return false
      recallHollow(state, chosen.code, api, { to: 'hand', seat: chosen.seat ?? inv.seat })
      const data = chapterState(state)
      data.hollowRecalledRound = state.round
      data.hollowRecalledSeat = inv.seat
      return true
    }
    if (rule === ACTION_RULES.mineGamble) return mineGambleAction(state, inv, api)
    if (rule === ACTION_RULES.outpostDraw) return outpostDrawAction(state, inv, api)
    if (rule === ACTION_RULES.scoutingReport) return scoutingReportAction(state, inv, api, move)
    return false
  },

  // ---- 幕 ----
  actReveal(state, act, api) {
    const code = codeOf(act)
    if (code === RAW_CODES.act1) {
      resolveRawDeal(state, api)
      return true
    }
    if (code === RAW_CODES.act2) {
      revealTrueForm(state, api)
      return true
    }
    if (code === RAW_CODES.act3) {
      enterOutsidersLair(state, api)
      return true
    }
    if (code === RAW_CODES.act4) {
      const version = thorneInPlay(state)
      const key = version === 'asset' ? 'resolution1' : version === 'enemy' ? 'resolution2' : 'resolution3'
      api?.info?.(`🔪 绝杀一击：场上索恩是${version === 'asset' ? '剧情支援' : version === 'enemy' ? '敌人' : '不在场'} → ${key}。`)
      if (typeof api?.finish === 'function') api.finish(key)
      return true
    }
    return false
  },

  // ---- 幕目标 ----
  checkObjectives(state, api) {
    const code = actCode(state)
    const data = chapterState(state)
    if (code === RAW_CODES.act3 && data.exposedLocation) {
      api?.info?.('🎯 真实形态已被揭露：推进场景。')
      api?.advanceAct?.()
      return true
    }
    if (code === RAW_CODES.act4 && data.trueFormDefeated) {
      api?.info?.('🎯 真实形态已被击败：推进场景。')
      api?.advanceAct?.()
      return true
    }
    return false
  },

  // 幕 2：任意轮末可以推进。
  roundEnded(state, api) {
    if (actCode(state) !== RAW_CODES.act2) return
    if (chapterState(state).act2RoundEndAsked === state.round) return
    chapterState(state).act2RoundEndAsked = state.round
    if (!aliveInvestigators(state).length) return
    const answer = choiceFor(api, {
      kind: 'story', source: RAW_CODES.act2, seat: LEAD_SEAT(state),
      prompt: '「如果它会流血……」轮末：是否推进场景？（推进会把捕食者引出来）',
      options: [{ id: 'advance', label: '推进场景（引出捕食者）' }, { id: 'wait', label: '再等等' }],
    })
    if (answer === 'advance') {
      api?.info?.('🎯 团队选择在轮末推进。')
      api?.advanceAct?.()
    }
  },

  // ---- 密谋 ----
  agendaReveal(state, agenda, api) {
    const code = codeOf(agenda)
    if (code === RAW_CODES.agenda1 || code === RAW_CODES.agenda2) {
      hollowAllyOrItemPerInvestigator(state, api)
      return true
    }
    if (code === RAW_CODES.agenda3) {
      eraseHighestHollows(state, api)
      api?.info?.('💀 灭绝：本场冒险的一切都被抹除 —— 结局 4「本场冒险从未发生」。')
      if (typeof api?.finish === 'function') api.finish('resolution4')
      return true
    }
    return false
  },

  // ---- 敌人 ----
  enemySpawned(state, enemy, api) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (rule?.spawnNearestWilderness) relocateToNearestWilderness(state, enemy, api)
    syncFellhoundKeywords(state)
    hunterLodgeMonsterDamage(state, enemy, api)
  },

  enemyMoved(state, enemy, from, api) {
    hunterLodgeMonsterDamage(state, enemy, api)
    void from
  },

  // 尤嗜鲜血：攻击你后查看牌库顶一张，不是弱点就作为空洞，并治愈等于该空洞印刷费用的伤害。
  enemyAttackResolved(state, enemy, inv, api) {
    if (!enemyRuleFor(codeOf(enemy))?.hollowDeckTopWhenAttacks) return
    if (!inv || inv.defeated || inv.resigned) return
    const hollowed = hollowFromDeckTop(state, inv.seat, api, { source: codeOf(enemy) })
    if (!hollowed) return
    const cost = Math.max(0, Number(ALL_CARDS[hollowed.code]?.cost) || 0)
    if (cost > 0 && typeof api?.healEnemy === 'function') {
      api.healEnemy(enemy, cost)
      api.info?.(`🩸 尤嗜鲜血：治愈 ${cost} 点伤害（按「${cardNameOf(hollowed.code)}」的印刷费用）。`)
    }
  },

  enemyDefeated(state, enemy, api) {
    const code = codeOf(enemy)
    if (code === RAW_CODES.thorneEnemy) {
      const keys = api?.mechanics?.tsk?.keys
      let attached = false
      try {
        const record = keys?.get?.(SABLE_GLASS_KEY.id)
        attached = record?.bearer?.type === 'enemy'
      } catch {
        attached = false
      }
      if (attached) transferSableGlassFromEnemy(state, api)
    }
    if (code === TRUE_FORM_CODE) {
      chapterState(state).trueFormDefeated = true
      if (actCode(state) === RAW_CODES.act4) {
        api?.info?.('🎯 虚空奇美拉（真实形态）被击败：推进场景。')
        api?.advanceAct?.()
      }
    }
    return undefined
  },

  // 巡逻（凶残巨喙）在敌人阶段开始移动；猎人跳过非[[荒地]]地点。
  enemyPhaseStart(state, api = {}) {
    for (const enemy of (state.enemies || []).slice()) {
      if (enemy.defeated || enemy.exhausted || enemy.engagedSeat != null) continue
      if (!enemyRuleFor(codeOf(enemy))?.patrol) continue
      resolvePatrol(state, api, enemy)
    }
  },

  hunterMove(state, enemy, api) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule?.skipsNonWildernessWhenMoving) return false
    const target = aliveInvestigators(state).find(inv => inv.location !== enemy.location)
    if (!target) return false
    const step = wildernessStepToward(state, enemy.location, target.location)
    if (!step) return false
    if (typeof api?.moveEnemy === 'function') api.moveEnemy(enemy, step)
    else enemy.location = step
    api?.info?.(`🐻 「${enemy.name || '饥饿的灰熊'}」跳过非[[荒地]]地点，移动到「${locationName(state, step)}」。`)
    return true
  },

  // ---- 遭遇卡：抽到[[危险]]诡计时索恩变换钥匙 ----
  encounterDrawn(state, inv, code, api) {
    if (!isHazardCode(code)) return
    const rule = enemyRuleFor(RAW_CODES.thorneEnemy)?.shiftsKeysOnHazardDrawn
    if (!rule) return
    const thorne = enemyOf(state, RAW_CODES.thorneEnemy)
    if (!thorne) return
    const keys = api?.mechanics?.tsk?.keys
    let record = null
    try {
      record = keys?.get?.(SABLE_GLASS_KEY.id)
    } catch {
      record = null
    }
    if (record?.bearer?.type !== 'enemy' || record.bearer.enemyId !== thorne.id) return
    api?.info?.('🔑 [[危险]]诡计被抽取：索恩变换身上的玄丧之镜。')
    resolveKeyShift(state, inv?.seat ?? LEAD_SEAT(state), api, { by: 'enemy' })
  },

  // ---- 遭遇卡 ----
  resolveEncounter(state, inv, card, api) {
    return resolveEncounterEntry(state, inv, card, api)
  },

  // ---- 结局 ----
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const bearerSeat = () => {
      const keys = api?.mechanics?.tsk?.keys
      try {
        const record = keys?.get?.(SABLE_GLASS_KEY.id)
        return record?.bearer?.type === 'investigator' ? record.bearer.seat : null
      } catch {
        return null
      }
    }
    const bindBearer = seat => {
      const keys = api?.mechanics?.tsk?.keys
      if (!keys) return
      try {
        keys.bind(SABLE_GLASS_KEY.id, seat == null ? { type: 'none' } : { type: 'investigator', seat })
      } catch {
        /* 无战役密钥容器时只写记录 */
      }
    }
    if (key === 'noResolution') {
      recordFact(state, RECORD_KEYS.theVoidChimeraEscaped, true)
      const dealt = hasRecord(state, RECORD_KEYS.dealWithThorne)
      const controller = bearerSeat()
      if (dealt || controller == null) {
        records.keysSableGlassBearer = 'thorne'
        bindBearer(null)
        api.info?.('🔑 玄丧之镜的持有者是索恩（战役日志记录）。')
      } else {
        recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfThorn, true)
        records.keysSableGlassBearer = controller
        api.info?.(`🔑 玄丧之镜由调查员 ${controller + 1} 持有；战役日志记录「你还没见过索恩的最后一面」。`)
      }
      markTime(state, 1)
      return { bonus: 0 }
    }
    if (key === 'resolution1') {
      records.keysSableGlassBearer = 'thorne'
      bindBearer(null)
      markTime(state, 3)
      api.info?.('🔑 结局 1：索恩带走玄丧之镜；记 3 点时间。')
      return { bonus: 0 }
    }
    if (key === 'resolution2') {
      recordFact(state, RECORD_KEYS.youHaventSeenTheLastOfThorn, true)
      const seat = bearerSeat() ?? LEAD_SEAT(state)
      records.keysSableGlassBearer = seat
      bindBearer(seat)
      markTime(state, 3)
      api.info?.('🔑 结局 2：调查员持有玄丧之镜；记 3 点时间。')
      return { bonus: 0 }
    }
    if (key === 'resolution3') {
      recordFact(state, RECORD_KEYS.thorneDisappeared, true)
      const controller = bearerSeat()
      records.keysSableGlassBearer = controller == null ? 'thorne' : controller
      bindBearer(controller)
      markTime(state, 3)
      api.info?.('🔑 结局 3：索恩消失；记 3 点时间。')
      return { bonus: 0 }
    }
    if (key === 'resolution4') {
      recordFact(state, RECORD_KEYS.nothingOfNoteInAnchorage, true)
      restoreProgress(state, api)
      api.info?.('🌀 结局 4：本场冒险从未发生 —— 不记时间、不记经验与创伤。')
      return { award: false, bonus: 0 }
    }
    return {}
  },
}

/** 遭遇卡条目分派（遇到没有条目也没有声明式检定的卡时返回 false，交回引擎）。 */
function resolveEncounterEntry(state, inv, card, api) {
  return resolveEncounter(state, inv, card, api)
}

/** 饥饿的灰熊「生成 - 最近的[[荒地]]地点」：把刚生成的敌人挪到最近的荒地。 */
export function relocateToNearestWilderness(state, enemy, api = null) {
  if (!enemy) return null
  const candidates = wildernessInPlay(state)
  if (!candidates.length) return null
  if (candidates.includes(enemy.location)) return enemy.location
  const distance = id => {
    const value = api?.locationDistance?.(enemy.location, [id])
    return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY
  }
  const best = [...candidates].sort((left, right) => distance(left) - distance(right)
    || String(left).localeCompare(String(right)))[0]
  if (!best) return null
  if (typeof api?.moveEnemy === 'function') api.moveEnemy(enemy, best)
  else enemy.location = best
  api?.info?.(`🐻 「${enemy.name || '饥饿的灰熊'}」生成在最近的[[荒地]]地点「${locationName(state, best)}」。`)
  return best
}

/** 猎人小屋：[[怪物]]敌人进入/生成时对它造成 1 点伤害（规则声明在 definition 的地点数据上）。 */
function hunterLodgeMonsterDamage(state, enemy, api) {
  if (!LOCATIONS.huntersLodge?.damageEnteringMonsters) return
  if (!enemy || !hasTrait(enemy, 'Monster')) return
  if (enemy.location !== 'huntersLodge') return
  if (enemy.huntersLodgeDamaged) return
  enemy.huntersLodgeDamaged = true
  if (typeof api?.damageEnemy === 'function') api.damageEnemy(enemy.id, 1)
  else enemy.damageTaken = (Number(enemy.damageTaken) || 0) + 1
  api?.info?.(`🏚️ 猎人小屋：[[怪物]]「${enemy.name || codeOf(enemy)}」进入时受到 1 点伤害。`)
}

/** 密谋 1/2 背面：每位调查员把一个[[盟友]]/[[道具]]支援（在场或手牌）放在一边作为空洞。 */
export function hollowAllyOrItemPerInvestigator(state, api) {
  const hollowed = []
  for (const inv of aliveInvestigators(state)) {
    const assets = (inv.assets || []).filter(asset => {
      const traits = ALL_CARDS[asset.code]?.traits || []
      return traits.includes('Ally') || traits.includes('Item')
    })
    const hand = (inv.hand || []).filter(code => {
      const traits = ALL_CARDS[code]?.traits || []
      return !isWeakness(code) && (traits.includes('Ally') || traits.includes('Item'))
    })
    const options = [
      ...assets.map(asset => ({ id: `asset:${asset.id}`, label: `在场：${cardNameOf(asset.code)}` })),
      // 2026-11-13 P1-16：同名手牌会生成重复 option id（resolution.js 会抛「选择选项 id 重复」，
      // 又被 choiceFor 当普通错误吞掉而静默默认第一项）。这里用下标保证唯一，并保留 cardCode。
      ...hand.map((code, index) => ({
        id: `hand:${index}:${code}`, cardCode: code, label: `手牌：${cardNameOf(code)}`,
      })),
    ]
    if (!options.length) {
      api?.info?.(`🕳️ ${inv.name || '调查员'} 没有[[盟友]]或[[道具]]可以放在一边。`)
      continue
    }
    const answer = options.length === 1 ? options[0].id : choiceFor(api, {
      kind: 'card', source: agendaCode(state) || RAW_CODES.agenda1, seat: inv.seat,
      prompt: '选择一个你控制的或手中的[[盟友]]/[[道具]]，放在一边作为空洞。',
      options,
    })
    const chosen = options.find(option => option.id === answer) || options[0]
    if (chosen.id.startsWith('asset:')) {
      const result = hollowAssetInPlay(state, inv.seat, chosen.id.slice('asset:'.length), api, { source: 'agenda' })
      if (result) hollowed.push(result.code)
    } else {
      const result = hollowFromHand(state, inv.seat, api, {
        code: chosen.cardCode || chosen.id.split(':').pop(), source: 'agenda',
      })
      if (result) hollowed.push(result.code)
    }
  }
  return hollowed
}

/** 密谋 3 背面：每位调查员放逐自己经验值费用最高的空洞，并记入存在抹除名单。 */
export function eraseHighestHollows(state, api) {
  const hollow = hollowApi(api)
  const cards = hollowCards(state)
  if (!hollow || !cards.length) return []
  const chosen = []
  const seats = [...new Set(cards.map(card => (card.scope === 'team' ? null : card.seat)))]
  for (const seat of seats) {
    const pool = cards.filter(card => (seat == null ? card.scope === 'team' : card.scope === 'team' || card.seat === seat))
    if (!pool.length) continue
    const best = [...pool].sort((left, right) =>
      (Number(ALL_CARDS[right.code]?.xp) || 0) - (Number(ALL_CARDS[left.code]?.xp) || 0)
      || (Number(ALL_CARDS[right.code]?.cost) || 0) - (Number(ALL_CARDS[left.code]?.cost) || 0)
      || String(left.code).localeCompare(String(right.code)))[0]
    if (best && !chosen.includes(best.code)) chosen.push(best.code)
  }
  const codes = chosen.length ? chosen : [cards[0].code]
  const erased = hollow.erase(codes)
  syncFellhoundKeywords(state)
  const unique = codes.filter(code => ALL_CARDS[code]?.unique)
  if (unique.length) recordFact(state, RECORD_KEYS.erasedFromExistence, true)
  const data = chapterState(state)
  data.erased = [...new Set([...(data.erased || []), ...codes])]
  api?.info?.(`💀 放逐 ${codes.map(code => cardNameOf(code)).join('、')}`
    + `${unique.length ? `；独特卡（${unique.map(code => cardNameOf(code)).join('、')}）记入「存在抹除」` : ''}。`)
  return { codes, erased }
}

/** 荒野内的最短步（猎人跳过非[[荒地]]地点）：只走[[荒地]]与目标地点。 */
export function wildernessStepToward(state, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null
  const queue = [[fromId, null]]
  const seen = new Set([fromId])
  while (queue.length) {
    const [id, firstStep] = queue.shift()
    const location = locationOf(state, id)
    for (const next of location?.connections || []) {
      if (seen.has(next)) continue
      const target = locationOf(state, next)
      if (!target) continue
      const step = firstStep || next
      if (next === toId) return step
      if (!isWilderness(target)) continue
      seen.add(next)
      queue.push([next, step])
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 只读投影（桌面/测试读得懂的章节摘要）
// ---------------------------------------------------------------------------
export function chapterSummary(state) {
  const data = state?.scenarioFlags?.[STATE_KEY] || {}
  return {
    wildernessOrder: [...(data.wildernessOrder || [])],
    scoutingReports: { ...(data.scoutingReports || {}) },
    outerWildernessOpened: data.outerWildernessOpened === true,
    exposedLocation: data.exposedLocation || null,
    trueFormDefeated: data.trueFormDefeated === true,
    thorneVersion: data.thorneVersion || null,
    rawDeal: data.rawDeal || null,
    decoyExposed: Number(data.decoyExposed) || 0,
    hollows: hollowCards(state).map(card => ({ code: card.code, seat: card.seat, scope: card.scope })),
    concealed: concealedMiniCards(state).map(card => ({
      id: card.id, kind: card.kind, decoy: card.decoy, locationId: card.locationId, known: card.known === true,
    })),
    hazardTreacheries: hazardTreacheriesInPlay(state),
    chimeraHere: (state?.investigators || []).map(inv => voidChimeraAtLocation(state, inv)),
    currentAct: codeOf((state.acts || [])[state.actIndex]) || null,
    currentAgenda: codeOf((state.agendas || [])[state.agendaIndex]) || null,
    entryCodes: [...behavior.implementedEncounterCodes],
    hollowCount: hollowCount(state, { scope: 'team' }),
    clueValueOfStart: clueValueOf(state, START_LOCATION),
  }
}

export const implementedEncounterCodes = behavior.implementedEncounterCodes
export const entryCodes = () => [...implementedEncounterCodes]
export { LOCATIONS, OUTSIDERS_LAIR, RAW_CODES, acts, agendas }
export default behavior
