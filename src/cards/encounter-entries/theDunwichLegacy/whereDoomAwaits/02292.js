// 02292 回忆迷宫
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：强制 - 在你揭示回忆迷宫后：你每剩余一个行动，受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { revealLead } from '../../_shared.js'

export default {
  code: '02292', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      const lead = revealLead(state, loc)
      if (lead) api.horror(lead.seat, lead.actionsLeft)
    },
  },
}
