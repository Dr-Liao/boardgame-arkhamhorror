// 02290 道路裂口
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：强制 - 在你揭示道路裂口后：如果你没有行动剩余，受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { revealLead } from '../../_shared.js'

export default {
  code: '02290', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      const lead = revealLead(state, loc)
      if (lead && !lead.actionsLeft) api.damage(lead.seat, 2)
    },
  },
}
