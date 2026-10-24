// 04081 迷失荒野
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：expedition
// 卡面：显现 - 检定[willpower](3)。如果你检定失败，每低于难度1点，受到1点恐惧，并将迷失荒野加入你的威胁区域。
// 卡面：你不能移动或探索。
// 卡面：强制 - 当你的回合结束时：弃掉迷失荒野。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04081', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    // 失败分支把卡放进威胁区域后要返回 true（= 已入场，引擎不再把本卡弃入遭遇弃牌堆）；
    // 成功分支返回 false 由引擎正常弃置。旧实现一律 return false，导致卡同时在威胁区与弃牌堆。
    let placed = false
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const failedBy = Math.max(0, 3 - result.value)
      for (let index = 0; index < failedBy; index++) api.horror(inv.seat, 1)
      if (!(inv.threat || []).some(item => originalOf(item) === '04081')) {
        api.threat(inv.seat, '04081', { forcedEndTurnDiscard: true })
        placed = true
      }
    })
    return placed
  },
}
