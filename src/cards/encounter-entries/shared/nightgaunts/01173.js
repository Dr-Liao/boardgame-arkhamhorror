// 01173 乘着黑暗之翼
// 归属：跨战役通用
// 遭遇组：nightgaunts
// 卡面：显现 - 检定[agility](4)。如果你检定失败，受到1点伤害和1点恐惧。然后，与每个和你交战的非[[夜魇]]敌人解除交战，并移动到一个[[中心]]地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { hasTrait } from '../../_shared.js'

export default {
  code: '01173', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 4, result => {
      if (result.success) return
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
      for (const enemy of state.enemies.filter(entry => entry.engagedSeat === inv.seat && !hasTrait(entry, 'Nightgaunt'))) {
        enemy.engagedSeat = null
        const engaged = state.investigators[inv.seat].engaged
        const index = engaged.indexOf(enemy.id)
        if (index >= 0) engaged.splice(index, 1)
      }
      const central = state.locations.find(entry => entry.central)
      if (central && central.id !== inv.location) api.moveInvestigator(inv.seat, central.id)
      else api.info?.('没有可退往的中心地点。')
    })
    return false
  },
}
