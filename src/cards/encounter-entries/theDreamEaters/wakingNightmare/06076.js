// 06076 手术室（Operating Room）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[action][action]：选择你所在地点的一位调查员并检定智识(4)。若你成功，治愈该调查员 3 点伤害。
//   若你失败，对该调查员造成 1 点伤害。
// 读点：locationRule.actions / performAction 由章节 behavior.actions / performAction 分派。
import { activeInvestigators } from '../../_shared.js'

const CODE = '06076'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({
        action: 'scenarioAction',
        rule: 'operatingRoomHeal',
        actions: 2,
        label: '🩺 手术室：[action][action] 检定智识(4)：成功治愈目标 3 点伤害，失败对其造成 1 点伤害',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'operatingRoomHeal') return false
      const candidates = activeInvestigators(state).filter(entry => entry.location === inv.location)
      if (!candidates.length) return true
      const answer = api.choice?.({
        kind: 'investigator', source: CODE, seat: inv.seat,
        prompt: '选择你所在地点的一位调查员。',
        options: candidates.map(entry => ({ id: String(entry.seat), label: entry.name })),
      })
      const target = candidates.find(entry => String(entry.seat) === String(answer)) || candidates[0]
      api.test?.(inv.seat, 'intellect', 4, result => {
        if (result.success) {
          api.healDamage?.(target.seat, 3)
          api.info?.(`🩺 手术室：${inv.name} 治愈了 ${target.name} 3 点伤害。`)
          return
        }
        api.damage?.(target.seat, 1)
        api.info?.(`🩺 手术室：${inv.name} 失败，对 ${target.name} 造成 1 点伤害。`)
      })
      return true
    },
  },
}
