// 八循环《绯红密钥》P2 原语：空洞（Hollow）与存在抹除（Erased from Existence）。
//
// 覆盖 P1 原语目录：
//   · new.hollowZone              —— 空洞区：手牌/牌库顶/投入卡/场上非弱点卡移出场外记为 hollow
//   · new.hollowCount             —— 个人 / 全队空洞计数
//   · new.hollowCountModifierScope—— 计数口径裁决（个人 or 全队，见下）
//   · new.hollowRecall            —— 空洞卡回收/洗回
//   · new.erasedFromExistence     —— 终局把空洞卡永久抹除并写入战役禁用名单
//   · extend.cardCounters         —— 卡实例具名计数器扩展 evidence/hollow 两个 id
//   · extend.records              —— 抹除名单/空洞名单进战役记录集合（campaign.tsk.erased）
//
// 状态：
//   · 场景级 `mechanicState.tsk.hollows = { version: 1, cards: [{ code, source, scope, seat }] }`
//       scope = 'investigator'（属于某个座位）| 'team'（全队共用）
//   · 战役级 `campaign.tsk.erased = { version: 1, codes: [...有序去重] }`
//
// 裁决（P1 标记 blocked 的 new.hollowCountModifierScope）：卡面用两种口径——
//   「你」= investigator（只算该座位），「你的队伍」/剧本级 = team（全队合计）。
//   本原语要求调用方在 hollowCard 时显式给 scope，缺失即拒绝；不做默认猜测。
import { randomValue } from './rules-state.js'
import { assertTskFields, assertTskObject, assertCodeList, tskCampaignState, tskScenarioState } from './tsk-state.js'

export const HOLLOW_STATE_VERSION = 1
export const HOLLOW_SCOPES = Object.freeze(['investigator', 'team'])

function stateOf(state, create = false) {
  const data = tskScenarioState(state, create)
  if (!data) return null
  if (create) return data.hollows ||= { version: HOLLOW_STATE_VERSION, cards: [] }
  return data.hollows || null
}

/**
 * 把一张卡移出场外记为空洞（Hollow）。
 * spec: { code, source?, scope, seat? }；scope='investigator' 时必须给合法 seat。
 * 非法字段/重复 code/非法座位在写入前抛错。
 */
export function hollowCard(state, spec) {
  assertTskObject(spec, '空洞记录')
  assertTskFields(spec, ['code', 'source', 'scope', 'seat'], '空洞记录')
  if (typeof spec.code !== 'string' || !spec.code) throw new TypeError('空洞卡号无效')
  if (!HOLLOW_SCOPES.includes(spec.scope)) throw new TypeError('空洞归属口径必须是 investigator/team')
  const container = stateOf(state, true)
  if (container.cards.some(card => card.code === spec.code)) throw new Error(`卡 ${spec.code} 已在空洞区`)
  let seat = null
  if (spec.scope === 'investigator') {
    if (!Number.isSafeInteger(spec.seat) || !state.investigators?.[spec.seat]) throw new RangeError('空洞归属座位无效')
    seat = spec.seat
  }
  const card = { code: spec.code, source: spec.source ?? null, scope: spec.scope, seat }
  container.cards.push(card)
  return { ...card }
}

/** 全部空洞卡（只读视图；不初始化容器）。 */
export function hollowCards(state) {
  return [...(stateOf(state)?.cards || [])]
}

/** 某张卡是否在空洞区。 */
export function isHollowed(state, code) {
  return (stateOf(state)?.cards || []).some(card => card.code === code)
}

/**
 * 空洞计数：按裁决口径过滤。
 *   · { scope: 'investigator', seat } —— 该座位名下 + 全队共享的空洞（团队口径对个人同样有效）
 *   · { scope: 'team' }              —— 全队合计
 */
export function hollowCount(state, { scope = 'team', seat } = {}) {
  if (!HOLLOW_SCOPES.includes(scope)) throw new TypeError('空洞计数口径必须是 investigator/team')
  const cards = stateOf(state)?.cards || []
  if (scope === 'team') return cards.length
  if (!Number.isSafeInteger(seat)) throw new RangeError('个人空洞计数需要合法座位')
  return cards.filter(card => card.scope === 'team' || card.seat === seat).length
}

/**
 * 回收一张空洞卡（效果把它洗回牌库/手牌）：返回被回收的记录；不在空洞区返回 null。
 * `shuffleInto` 只有 'deck'|'hand'|'discard' 三种目标；牌库时按 state.rngState 混洗位置（不暴露顺序）。
 */
export function recallHollow(state, code, { to = 'discard' } = {}) {
  if (!['deck', 'hand', 'discard'].includes(to)) throw new TypeError('空洞回收目标必须是 deck/hand/discard')
  const container = stateOf(state)
  const index = container?.cards.findIndex(card => card.code === code) ?? -1
  if (index < 0) return null
  const [card] = container.cards.splice(index, 1)
  return { ...card, to }
}

/**
 * 存在抹除：把一批空洞卡永久写入战役禁用名单（ErasedFromExistence）。
 * 只有「当前在空洞区」的卡才能被抹除；未知卡号整批拒绝（不产生部分写入）。
 * 返回抹除后的名单副本。
 */
export function eraseFromExistence(state, codes) {
  assertCodeList(codes, '抹除卡号')
  const hollowed = new Set((stateOf(state)?.cards || []).map(card => card.code))
  for (const code of codes) if (!hollowed.has(code)) throw new RangeError(`卡 ${code} 不在空洞区，不能抹除`)
  const campaign = tskCampaignState(state, true)
  campaign.erased ||= { version: HOLLOW_STATE_VERSION, codes: [] }
  assertTskFields(campaign.erased, ['version', 'codes'], '存在抹除名单')
  if (campaign.erased.version !== HOLLOW_STATE_VERSION) throw new TypeError('不支持的存在抹除版本')
  for (const code of codes) if (!campaign.erased.codes.includes(code)) campaign.erased.codes.push(code)
  // 抹除后卡不再留在空洞区（它们已不可能回到对局）。
  stateOf(state).cards = stateOf(state).cards.filter(card => !codes.includes(card.code))
  return [...campaign.erased.codes]
}

/** 战役禁用名单（抹除+内容层登记的禁用卡）；不初始化容器。 */
export function erasedFromExistence(state) {
  return [...(tskCampaignState(state)?.erased?.codes || [])]
}

/** 某卡是否已被存在抹除。 */
export function isErasedFromExistence(state, code) {
  return erasedFromExistence(state).includes(code)
}

/**
 * 战役禁用卡（new.invalidCards）：存在抹除名单 + 内容层在 `campaign.tsk.invalidCards` 登记的
 * 战役禁用卡（例如规则书明确移出游戏的卡）。构筑/换牌时由 P6 的可用性过滤读取。
 * 只读；不初始化容器。
 */
export function invalidCampaignCards(state) {
  const registered = tskCampaignState(state)?.invalidCards
  const list = registered == null ? [] : Array.isArray(registered) ? registered : (registered.codes ?? [])
  return [...new Set([...erasedFromExistence(state), ...list])].sort()
}

/** 某卡是否在战役禁用/抹除名单里（构筑可用性读点）。 */
export function cardInvalidInCampaign(state, code) {
  return invalidCampaignCards(state).includes(code)
}

/**
 * 空洞/抹除的合法动作载荷（extend.choices）：给服务端选择事务与 P4 面板使用。
 * 只返回规则相关字段，不发提示文案。
 */
export function hollowChoices(state) {
  return {
    hollows: hollowCards(state).map(card => ({ code: card.code, scope: card.scope, seat: card.seat, source: card.source })),
    erasable: hollowCards(state).map(card => card.code),
    erased: erasedFromExistence(state),
  }
}

/** 牌库混洗的确定性辅助（回收进牌库时用 randomValue；不暴露牌序）。 */
export function shuffledHollowRecall(state, codes, { shuffle } = {}) {
  assertCodeList(codes, '回收卡号')
  const list = [...codes]
  if (shuffle != null) {
    if (typeof shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
    const mixed = shuffle([...list])
    if (!Array.isArray(mixed) || mixed.length !== list.length || mixed.slice().sort().join('|') !== list.slice().sort().join('|')) {
      throw new TypeError('shuffle 回调不得增删卡号')
    }
    return mixed
  }
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomValue(state) * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** 读档校验：空洞容器形状（存在才校验；座位必须合法）。 */
export function validateTskHollows(state, value = stateOf(state)) {
  if (value == null) return true
  assertTskFields(value, ['version', 'cards'], '空洞状态')
  if (value.version !== HOLLOW_STATE_VERSION) throw new TypeError(`不支持的空洞状态版本 ${value.version}`)
  if (!Array.isArray(value.cards)) throw new TypeError('空洞卡列表无效')
  const codes = new Set()
  for (const card of value.cards) {
    assertTskFields(card, ['code', 'source', 'scope', 'seat'], '空洞卡记录')
    if (typeof card.code !== 'string' || !card.code || codes.has(card.code)) throw new TypeError('空洞卡号重复或无效')
    codes.add(card.code)
    if (!HOLLOW_SCOPES.includes(card.scope)) throw new TypeError('空洞归属口径无效')
    if (card.source != null && typeof card.source !== 'string') throw new TypeError('空洞来源无效')
    if (card.scope === 'investigator' && (!Number.isSafeInteger(card.seat) || !state.investigators?.[card.seat])) {
      throw new TypeError('空洞归属座位无效')
    }
  }
  return true
}

/** 读档校验：战役抹除名单形状（存在才校验）。 */
export function validateTskErased(state, value = tskCampaignState(state)?.erased) {
  if (value == null) return true
  assertTskFields(value, ['version', 'codes'], '存在抹除名单')
  if (value.version !== HOLLOW_STATE_VERSION) throw new TypeError(`不支持的存在抹除版本 ${value.version}`)
  assertCodeList(value.codes, '存在抹除名单')
  if (new Set(value.codes).size !== value.codes.length) throw new TypeError('存在抹除名单重复')
  return true
}

/** 读档校验：战役禁用卡登记（存在才校验；可以是数组或 { codes }）。 */
export function validateTskInvalidCards(state, value = tskCampaignState(state)?.invalidCards) {
  if (value == null) return true
  const list = Array.isArray(value) ? value : value?.codes
  assertCodeList(list, '战役禁用卡登记')
  return true
}
