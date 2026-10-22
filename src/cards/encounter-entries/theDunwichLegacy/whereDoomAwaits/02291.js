// 02291 漂浮之森
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：强制 - 在你揭示漂浮之森后：如果你没有行动剩余，弃掉你牌库顶的5张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { revealLead } from '../../_shared.js'

export default {
  code: '02291', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      const lead = revealLead(state, loc)
      if (lead && !lead.actionsLeft) api.discardTop(lead.seat, 5)
    },
  },
}
