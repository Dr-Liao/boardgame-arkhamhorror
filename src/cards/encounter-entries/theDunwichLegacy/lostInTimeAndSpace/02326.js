// 02326 无尽之桥
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 将无尽之桥放置入场并失去2资源。
// 卡面：强制 - 在调查员离开无尽之桥后：在无尽之桥上放置1个毁灭标记，或将无尽之桥弃掉。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '02326', scope: 'location',
  locationRule: {
    onDraw(state, loc, api, seat) {
      const inv = state.investigators[seat]
      inv.resources = Math.max(0, inv.resources - 2)
    },
    onLeave: {
      effect(state, loc, api, inv) {
        const choice = api.choose({ kind: 'location', source: '02326', seat: inv.seat,
          prompt: '离开无尽之桥：放置 1 个毁灭，或弃掉它？',
          options: [{ id: 'doom', label: '放置 1 个毁灭' }, { id: 'discard', label: '弃掉无尽之桥' }] })
        if (choice === 'doom') loc.doom = (loc.doom || 0) + 1
        else {
          api.remove(loc.id)
          state.encounterDiscard.push(originalOf(loc))
        }
      },
    },
  },
}
