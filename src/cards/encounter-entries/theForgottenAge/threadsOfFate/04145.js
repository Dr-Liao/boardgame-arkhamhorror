// 04145 屋中无人
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 附属到你所在地点。如果你所在地点没有线索，屋中无人获得涌动。
// 卡面：你必须花费额外1个行动来调查所附属地点。
// 卡面：强制 - 如果所附属地点没有线索：弃掉屋中无人。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '04145', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const location = (state.locations || []).find(entry => entry.id === inv.location)
    if (!location) return false
    if ((location.clues || 0) === 0) {
      api.drawEncounter(inv.seat)
      return false
    }
    // 卡面没有「每个地点仅限 1 张」：第二张仍会附属，但「额外 1 行动」只算一次（与旧实现一致）。
    const copies = (location.attachments || []).filter(entry => originalOf(entry) === '04145').length
    const attachment = api.attachToLocation?.(location.id, {
      id: `nobodys-home:${state.round}:${location.id}`,
      code: '04145', originalCode: '04145',
      extra: { investigateExtraActions: copies ? 0 : 1 },
    })
    if (!attachment) return false
    api.info?.('「屋中无人」附属到此地点：调查它需要额外 1 个行动。')
    return true
  },
}
