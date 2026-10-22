// 04087 林中暗箭
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：guardians_of_time
// 卡面：显现 -受到1点伤害，你每控制一个盟友支援，受到额外1点伤害。在[[古代]]地点上的其他每位调查员也必须结算此效果。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { hasTrait } from '../../../_shared.js'

export default {
  code: '04087', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const harm = seat => {
      const target = state.investigators[seat]
      const allies = target.assets.filter(asset => hasTrait(asset, 'Ally')).length
      api.damage(seat, 1 + allies)
    }
    harm(inv.seat)
    for (const other of state.investigators.filter(item => !item.defeated && !item.resigned)) {
      if (other.seat === inv.seat) continue
      const here = state.locations.find(location => location.id === other.location)
      if (hasTrait(here, 'Ancient')) harm(other.seat)
    }
    return false
  },
}
