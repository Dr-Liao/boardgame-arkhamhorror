// 02286 诡异空地
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：强制 - 在你揭示诡异空地后：你每剩余一个行动，弃掉你牌库顶2张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { revealLead } from '../../_shared.js'

export default {
  code: '02286', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      const lead = revealLead(state, loc)
      if (lead) api.discardTop(lead.seat, 2 * lead.actionsLeft)
    },
  },
}
