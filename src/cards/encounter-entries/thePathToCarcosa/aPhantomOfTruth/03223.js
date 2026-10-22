// 03223 双生太阳
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：显现 - 检定[intellect](4)。如果你检定失败，你必须从当前密谋上移除1个毁灭标记，或每低于难度1点就受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 双生太阳（03223）：智识（4）失败后移除 1 个毁灭或按差额受到恐惧。

import { originalOf } from '../../_shared.js'

export default {
  code: '03223', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const code = originalOf(card)
    api.test(inv.seat, 'intellect', 4, result => {
      if (result.success) return
      const failedBy = Math.max(1, result.difficulty - result.value)
      const options = state.doom > 0
        ? [{ id: 'doom', label: '从当前密谋移除 1 个毁灭' }, { id: 'horror', label: `承受 ${failedBy} 点恐惧` }]
        : [{ id: 'horror', label: `承受 ${failedBy} 点恐惧` }]
      const choice = options.length === 1 ? 'horror' : api.choose({
        kind: 'encounter', source: code, seat: inv.seat, prompt: '双生太阳：移除毁灭或承受恐惧。', options,
      })
      if (choice === 'doom') state.doom = Math.max(0, state.doom - 1)
      else api.horror(inv.seat, failedBy)
    })
    return false
  },
}
