// 03225 折磨和弦
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：显现 - 检定[willpower](5)。如果你检定失败，将折磨和弦放置入场，放到你的威胁区域，且你每低于难度1点，其带有1资源。
// 卡面：每次你打出一张卡牌，提升该卡牌的费用1点并从折磨和弦移除1资源。
// 卡面：如果折磨和弦没有资源，将其弃掉。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 威胁区卡（03225 / 03226）。

import { failedBy } from '../../_shared.js'

export default {
  code: '03225', implemented: true, scope: 'treachery', threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
  encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    let placed = false
    api.test(inv.seat, 'willpower', 5, result => {
      if (result.success) return
      api.threat(inv.seat, '03225', {
        resources: failedBy(result, 5),
        threatEffect: { playCostIncrease: 1, consumeResourceAfterPlay: true },
      })
      placed = true
    })
    return placed
  },
}
