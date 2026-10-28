// 02083 穿越时间的幻觉
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：sorcery
// 卡面：显现 - 检定[willpower](5)。你检定失败且每低于难度1点，弃掉你牌库顶的1张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { failedBy } from '../../../_shared.js'

export default {
  code: '02083', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 5, result => {
      if (!result.success) api.discardTop(inv.seat, failedBy(result, 5))
    })
    return false
  },
}
