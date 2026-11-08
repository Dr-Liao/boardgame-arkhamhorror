// 08658 地球根源（Roots of the Earth）· 诡计 · the_heart_of_madness
// 卡面：显现 - 检定[agility](2)。你所在地点到伊夸之门每需移动一次，本次检定得到 +1 难度。
//   如果你检定失败，受到 2 点伤害。
// 读点：距离走连接图 BFS；伊夸之门按印刷卡号 08649 定位。
import { entryDistance } from '../../../_shared.js'

const CODE = '08658'
const gateId = state => state.locations.find(loc => (loc.originalCode || loc.code) === '08649')?.id || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const gate = gateId(state)
    const distance = gate ? entryDistance(state, inv.location, gate) : 0
    const difficulty = 2 + (Number.isFinite(distance) && distance > 0 ? distance : 0)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (!result.success) api.damage(inv.seat, 2)
    })
    return false
  },
}

