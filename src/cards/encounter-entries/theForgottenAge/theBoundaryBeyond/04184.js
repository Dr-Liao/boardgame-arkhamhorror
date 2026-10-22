// 04184 圣林
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在圣林入场后：每位在本地点的调查员弃掉其牌库顶的10张卡牌。
// 卡面：[action]如果你牌库内没有剩余卡牌：发现圣林所有的线索。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { discoverAt } from '../../_shared.js'

export default {
  code: '04184', scope: 'location',
  locationRule: {
    ancientAction: {
      label: '📖 如果你牌库内没有剩余卡牌：发现圣林所有的线索',
      available(state, inv) { return (inv.deck || []).length === 0 },
      perform(state, inv, api, location) {
        if ((inv.deck || []).length > 0) return false
        discoverAt(state, api, inv, location, location.clues || 0)
        return true
      },
    },
  },
}
