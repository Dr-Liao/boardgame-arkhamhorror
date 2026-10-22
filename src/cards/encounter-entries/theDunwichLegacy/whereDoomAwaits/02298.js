// 02298 时间旋涡
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：显现 - 每位哨兵山地点的调查员检定[willpower](4)。每位检定失败的调查员受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02298', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    for (const target of activeInvestigators(state).filter(other =>
      state.locations.find(loc => loc.id === other.location)?.traits
        ?.some(trait => trait.toLowerCase() === 'sentinel hill'))) {
      api.test(target.seat, 'willpower', 4, result => { if (!result.success) api.damage(target.seat, 2) })
    }
    return false
  },
}
