// 01136 错误指示
// 归属：跨战役通用
// 遭遇组：arkham
// 卡面：显现 - 如果你没有线索，错误指示获得涌动。如果你有至少1个线索，检定[intellect](4)。你检定失败且每低于难度1点，将你的1个线索放到你所在地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { syncCluesInEntry } from '../../_shared.js'

export default {
  code: '01136', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    if ((inv.clues || 0) === 0) { api.drawEncounter(inv.seat); return false }
    api.test(inv.seat, 'intellect', 4, result => {
      if (result.success) return
      const location = (state.locations || []).find(entry => entry.id === inv.location)
      const failedBy = Math.max(0, 4 - (result.value ?? 0))
      for (let index = 0; index < failedBy && (inv.clues || 0) > 0; index++) {
        inv.clues -= 1
        if (location) location.clues = (location.clues || 0) + 1
      }
      syncCluesInEntry(state)
    })
    return false
  },
}
