// 03185 约束衣
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：显现 - 如果你的威胁区域没有约束衣，将约束衣放置入场，放到你的威胁区域，作为一个占用1个身体槽位和2个手部槽位的支援。将那些槽位的每个支援返回你的手牌。除非通过以下能力，否则本卡牌不能离场。
// 卡面：[action][action]：弃掉约束衣。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 约束衣（03185）：显现时变成占据身体与手部槽位的支援；除了弃掉它之外不能离场。

import { ALL_CARDS, originalOf } from '../../_shared.js'

// 卡面「占用 1 个身体槽位和 2 个手部槽位」：双手卡在卡面数据里写作 "Hand x2"，
// 和单手的 "Hand" 同属手部槽位（引擎 normalizedSlots 把 "Hand x2" 归一为 handx2）。
// 只比较 'Body'/'Hand' 会漏掉双手武器，导致猎枪、球棒这类卡没有被返回手牌。
function takesBodyOrHandSlot(slot) {
  const key = String(slot).trim().toLowerCase()
  return key === 'body' || key === 'hand' || key === 'hand x2' || key === 'handx2'
}

export default {
  code: '03185', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  // 第 124 轮：旧存档迁移按这个标志找「束身衣」（原 card-rules.js 常量）。
  legacyStraitjacket: true,
  name: '约束衣',
  text: '显现 - 如果你的威胁区域没有约束衣，将约束衣放到你的威胁区域，作为一个占用 1 个身体槽位和 2 个手部槽位的支援。',
  encounterResolve(state, inv, card, api) {
    const code = originalOf(card)
    if (inv.threat.some(threat => threat.code === code)) return false
    for (const asset of [...inv.assets]) {
      // 槽位以卡面数据为准；个别实例覆盖 slots 时（与引擎 slotUsage 同口径）优先读实例。
      const def = ALL_CARDS[asset.code]
      const slots = (Array.isArray(asset.slots) && asset.slots.length ? asset.slots : def?.slots) || []
      if (!slots.some(takesBodyOrHandSlot)) continue
      api.removeAsset(inv.seat, asset.id)
      // 被「不能离场」等离场钩子挡下的支援仍留在场上；已由离场反应送回手/移出游戏的也不再重复塞一次。
      if (inv.assets.includes(asset) || asset.removedFromGame || asset.returnedToHand) continue
      inv.hand.push(asset.code)
    }
    api.threat(inv.seat, code, {
      slots: ['Body', 'Hand x2'],
      slotsOverride: true,
      cannotLeavePlay: true,
      threatEffect: { discardCost: { action: 2 }, sameLocationAction: true },
    })
    return true
  },
}
