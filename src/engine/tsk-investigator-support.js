// 八循环《绯红密钥》P5：调查员专属引擎读点（通用原语接线，无卡号分支）。
//
// 这些状态只对「条目在 investigator 字段里声明了对应 flag 的调查员」创建/写入；
// 既有 13 局 golden replay 使用的调查员都没有这些声明，因此回放指纹不受影响：
//   · investigator.trackCommitToOther —— 记录本回合是否把牌投入到别人的检定（卡森 09003 用）；
//   · investigator.setup.setAsideSignature —— 开局把签名卡放场外（文森特 09006 用）；
//   · investigator.extraSlots —— 额外槽位（查理 3 个盟友槽，assets.js 读点）；
//   · investigator.freeAction（resolve + cost.action + restrictedKind）—— 调查员主动能力
//     （卡森 [action]；原语在 moves.js / actions-extra.js 读，原有 effect DSL 免费行动不受影响）。
import { registeredEntry } from './ability.js'

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function tskInvestigatorRule(code) {
  const rule = registeredEntry(code)?.investigator
  return isObject(rule) ? rule : null
}

/** 额外槽位声明：`investigator.extraSlots = { ally: 3 }`。读点 assets.js#canEquip。 */
export function extraInvestigatorSlots(code) {
  const slots = tskInvestigatorRule(code)?.extraSlots
  if (!isObject(slots)) return {}
  return Object.fromEntries(Object.entries(slots).filter(([slot, count]) =>
    ['hand', 'arcane', 'ally', 'accessory', 'body', 'tarot'].includes(slot) && Number.isSafeInteger(count) && count > 0))
}

/** 「投入到其他调查员执行的检定」记账：卡森 09003 的轮末强制条件读它。 */
export function tracksCommitToOther(code) {
  return tskInvestigatorRule(code)?.trackCommitToOther === true
}

export function noteCommitToOther(state, inv) {
  if (!inv || !tracksCommitToOther(inv.code)) return false
  inv.committedToOtherThisTurn = { round: state.round }
  return true
}

export function committedToOtherThisTurn(state, inv) {
  const mark = inv?.committedToOtherThisTurn
  return isObject(mark) && mark.round === state.round
}

export function resetTskTurnTracking(state, inv) {
  if (!inv) return
  if (inv.committedToOtherThisTurn != null) delete inv.committedToOtherThisTurn
}

/** 开局读点：场外签名卡 + 条目 setup 描述子（setup.js 调用）。 */
export function runTskInvestigatorSetup(state, inv, { executeDescriptor, events }) {
  const rule = tskInvestigatorRule(inv.code)
  if (!rule) return
  const setAside = rule.setup?.setAsideSignature
  if (setAside?.code) {
    const count = setAside.perInvestigator === true ? Math.max(1, state.investigators.length) : 1
    state.setAside ||= []
    for (let i = 0; i < count; i++) {
      const index = (inv.deck || []).indexOf(setAside.code)
      if (index < 0) break
      inv.deck.splice(index, 1)
      state.setAside.push({ id: `setAside-${inv.seat}-${setAside.code}-${i}`, code: setAside.code, ownerSeat: inv.seat })
    }
  }
  for (const descriptor of registeredEntry(inv.code)?.abilities || []) {
    if (descriptor.kind !== 'setup' || typeof descriptor.resolve !== 'function') continue
    executeDescriptor(state, { inv, source: { code: inv.code }, descriptor, events, silent: true })
  }
}

export function tskInvestigatorSetAside(state, seat, code) {
  return (state.setAside || []).filter(card => card.code === code && card.ownerSeat === seat)
}

/** 存档校验：只允许已知字段与形状。 */
export function validateTskInvestigatorFields(inv) {
  if (inv?.committedToOtherThisTurn != null) {
    const mark = inv.committedToOtherThisTurn
    if (!isObject(mark) || Object.keys(mark).some(key => key !== 'round') || !Number.isSafeInteger(mark.round) || mark.round < 1) {
      throw new TypeError('非法「投入到他人检定」记账存档')
    }
  }
  return true
}
