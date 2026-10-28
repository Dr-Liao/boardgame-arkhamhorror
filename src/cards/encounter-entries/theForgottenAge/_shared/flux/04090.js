// 04090 时间裂缝
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：flux
// 卡面：显现 - 检定[willpower](3)。你失败且每低于难度1点，必须失去1个行动或受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { failedBy } from '../../../_shared.js'

export default {
  code: '04090', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const amount = failedBy(result, 3)
      for (let index = 0; index < amount; index++) {
        const answer = api.choose({
          kind: 'harm', source: '04090', seat: inv.seat,
          prompt: `时间裂缝：第 ${index + 1}/${amount} 点差额，选择失去 1 个行动或受到 1 点恐惧。`,
          options: [{ id: 'action', label: '失去 1 个行动' }, { id: 'horror', label: '受到 1 点恐惧' }],
        })
        if (answer === 'horror') api.horror(inv.seat, 1)
        else api.loseActions(inv.seat, 1)
      }
    })
    return false
  },
}
