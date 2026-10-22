// 02331 现实崩塌
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 如果你在[[异次元]]地点，将其弃掉并受到1点伤害。否则，受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '02331', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const location = state.locations.find(item => item.id === inv.location)
    if (location?.traits?.some(trait => trait.toLowerCase() === 'extradimensional')) {
      api.remove(location.id)
      state.encounterDiscard.push(originalOf(location))
      api.damage(inv.seat, 1)
    } else api.damage(inv.seat, 2)
    return false
  },
}
