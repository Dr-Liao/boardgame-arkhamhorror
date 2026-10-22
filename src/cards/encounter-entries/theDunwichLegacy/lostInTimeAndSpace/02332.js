// 02332 虫洞
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 从遭遇牌库顶弃牌，直到弃掉一个地点。结算该地点的“显现”能力，然后移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '02332', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const location = api.drawEncounterLocation(inv.seat)
    if (!location) return false
    api.moveInvestigator(inv.seat, location.id)
    if (!inv.defeated && !inv.resigned && inv.location != null) {
      const agendaCode = originalOf(state.agendas[state.agendaIndex] || {})
      if (['02312', '02313', '02314', '02315'].includes(agendaCode)) api.horror(inv.seat, 1)
    }
    return false
  },
}
