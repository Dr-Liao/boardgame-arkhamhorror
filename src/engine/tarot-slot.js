// 塔罗槽位与开局入场原语 —— 第 2 步 P2.9。
//
// 万象无终的 7 张玩家塔罗卡（05023/05027/05031/05035/05039/05040/05042）都是 **Tarot 槽位**
// 的支援，普通牌库卡：默认 1 个塔罗槽，额外槽位由修正管线 `add:slot` + `value: 'tarot'` 提供
// （安娜·卡斯洛 +2、月光吊坠 +1）。
//
// 本文件提供三个读点与一个开局动作（都不含卡号）：
//   1. 槽位：`tarotSlotCapacity` / `tarotSlotUsage` / `tarotSlotInfo`；
//   2. 开局入场：条目声明 `entersPlayFromOpeningHand: true` —— 起始手牌里有它就放置入场（不付费用）；
//   3. 手牌封锁：条目声明 `blocksCommitWhileInHand: true`（高塔）—— 它在你手牌里时你不能投入任何卡牌；
//      以及 `cannotMulliganAway: true` —— 起始手牌抽到后不能换掉。
//
// 「超槽」由引擎的 canEquip 统一判定（槽位容量 + slotBonus）；本文件不重复实现装备规则。

import { slotBonus } from './modifiers.js'

export const TAROT_SLOT = 'tarot'
// 引擎的默认塔罗槽容量（与 assets.js 的 SLOT_CAPACITY 同源；这里只用于展示/测试读数）。
export const TAROT_SLOT_BASE = 1

// 槽位在卡面定义上（cards-data 的 slots/slot），资产实例只带 code；因此接受一个可选的
// 卡面查询函数（引擎注入 cardDef），与 canEquip 读同一份数据。
export function isTarotCard(card, defOf = null) {
  const source = (Array.isArray(card?.slots) || card?.slot)
    ? card
    : (defOf?.(card?.code) || null)
  const slots = Array.isArray(source?.slots) ? source.slots : source?.slot ? [source.slot] : []
  return slots.some(slot => String(slot).trim().toLowerCase() === TAROT_SLOT)
}

export function tarotSlotUsage(inv, defOf = null) {
  return (inv?.assets || []).filter(asset => isTarotCard(asset, defOf)).length
    + (inv?.threat || []).filter(card => isTarotCard(card, defOf)).length
}

// 容量 = 基础 1 + 修正管线里的 add:slot(tarot) / slot:tarot。
export function tarotSlotCapacity(inv) {
  return TAROT_SLOT_BASE + slotBonus(inv, TAROT_SLOT)
}

export function tarotSlotInfo(state, inv, defOf = null) {
  const capacity = tarotSlotCapacity(inv)
  const usage = tarotSlotUsage(inv, defOf)
  return { capacity, usage, free: Math.max(0, capacity - usage) }
}

// 起始手牌里需要「开局放置入场」的卡（按条目声明）。
export function openingHandEntries(inv, lookup) {
  return (inv?.hand || []).filter(code => lookup(code)?.entersPlayFromOpeningHand === true)
}

// 把起始手牌里声明的卡放置入场：从手牌移除、生成场上实例（不付费用）。
// `createAsset(state, inv, code)` 由引擎注入，保证实例编号与平时一致。
export function enterOpeningHandCards(state, inv, { lookup, createAsset, info, events } = {}) {
  const codes = openingHandEntries(inv, lookup)
  if (!codes.length) return []
  for (const code of codes) {
    const index = inv.hand.indexOf(code)
    if (index < 0) continue
    inv.hand.splice(index, 1)
    inv.assets ||= []
    inv.assets.push(createAsset(state, inv, code))
  }
  info?.(state, events, `🎴 ${inv.name} 把起始手牌里的 ${codes.length} 张塔罗放置入场。`)
  return codes
}

// 「手牌里有这张时不能投入任何卡牌」的封锁来源（高塔）。
export function handCommitBlocker(inv, lookup) {
  for (const code of inv?.hand || []) {
    if (lookup(code)?.blocksCommitWhileInHand === true) return code
  }
  return null
}

// 换起始手牌时可以换掉的牌（去掉 cannotMulliganAway），返回 [{ code, index }]。
export function mulliganCandidates(inv, lookup) {
  return (inv?.hand || []).map((code, index) => ({ code, index }))
    .filter(({ code }) => lookup(code)?.cannotMulliganAway !== true)
}

// 换牌后仍必须保留在手牌里的牌（用于校验/测试展示）。
export function mulliganProtectedCodes(inv, lookup) {
  return (inv?.hand || []).filter(code => lookup(code)?.cannotMulliganAway === true)
}
