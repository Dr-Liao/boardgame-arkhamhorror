// 03208 蒙巴纳斯
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：[free]弃掉你一张手牌：获得与弃掉的卡牌上[willpower]图标数量相等的资源。(每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 119 轮：真相幻影（卡尔克萨第三章）的地点与遭遇卡。
// 地点的「不能离开」锁用 locationRule.exitLock 声明（内容层统一读）。
// 蒙帕纳斯（03208）：[free] 弃 1 张手牌，按意志图标数获得资源（每轮每座位一次）。

import { originalOf } from '../../_shared.js'

export default {
  code: '03208', scope: 'location',
  locationRule: {
    actions({ state, inv, location, moves }) {
      const perRoundKey = `${originalOf(location)}:${inv.seat}`
      if (state.scenarioFlags?.[perRoundKey] === state.round) return
      const discardable = inv.hand.some(card => !inv.hiddenCards?.includes(card))
      moves.push({ action: 'scenarioAction', rule: 'montparnasseDiscard', actions: 0,
        label: '弃掉1张手牌，获得等同其意志图标数量的资源',
        reason: discardable ? null : '需要 1 张可弃的手牌（隐藏的疯狂牌不能弃）' })
    },
  },
}
