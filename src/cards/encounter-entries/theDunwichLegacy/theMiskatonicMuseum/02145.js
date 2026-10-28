// 02145 短暂的展览
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：显现 - 检定[intellect](3)。如果你检定失败，每低于难度1点，失去1个行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { failedBy } from '../../_shared.js'

export default {
  code: '02145', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'intellect', 3, result => {
      if (!result.success) api.loseActions(inv.seat, failedBy(result, 3))
    })
    return false
  },
}
