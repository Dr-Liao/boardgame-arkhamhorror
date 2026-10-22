// 04096 阴影笼罩
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：pnakotic_brotherhood
// 卡面：显现 - 如果场上没有[[异教徒]]敌人，受到1点恐惧，且阴影笼罩获得涌动。否则，找到离你最近的[[异教徒]]敌人。在该敌人上放置1个毁灭标记并检定[willpower](X)，其中X等于该敌人的攻击值。如果你检定失败，受到2点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { hasTrait, entryDistance } from '../../../_shared.js'

export default {
  code: '04096', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const cultists = state.enemies.filter(enemy => hasTrait(enemy, 'Cultist'))
    if (!cultists.length) {
      api.horror(inv.seat, 1)
      api.drawEncounter(inv.seat)
      return false
    }
    const target = [...cultists].sort((left, right) =>
      entryDistance(state, inv.location, left.location) - entryDistance(state, inv.location, right.location))[0]
    if (target) target.doom = (target.doom || 0) + 1
    api.test(inv.seat, 'willpower', target ? ((target.fight || 0) + (target.doom || 0)) : 3, result => {
      if (!result.success) api.horror(inv.seat, 2)
    })
    return false
  },
}
