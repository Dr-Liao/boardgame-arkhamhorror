// 06231 诡计「被迫藏身」（Forced into Hiding · [[恐怖]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：显现 - 检定意志（X），其中 X 为你的警报等级。
// 如果你检定失败，失去 1 个行动。如果你检定失败且低于难度至少 3 点，改为失去 2 个行动。
// 如果你检定失败且低于难度至少 5 点，改为失去 3 个行动。
//
// 依据 Haskell Treachery/Cards/.../ForcedIntoHiding.hs（InvestigatorTokenCountCalculation AlarmLevel、
// FailedThisSkillTestBy n → LoseActions（n>=5?3:n>=3?2:1））：
//   · 难度是动态的（= 该调查员当前警报等级）→ encounterResolve 里手写一次 api.test（声明式 test 只能静态难度）；
//   · 失败差值取实际难度与结果（failedBy 口径），失去行动走 api.loseActions。
import { failedBy } from '../../_shared.js'

const ALARM = 'alarmLevel'
const FORCED_INTO_HIDING = '06231'

export default {
  code: FORCED_INTO_HIDING,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, treachery, api) {
    const difficulty = Math.max(0, Number(api.counters.get(inv.seat, ALARM)) || 0)
    api.test?.(inv.seat, 'willpower', difficulty, result => {
      if (result.success) return
      const gap = failedBy(result, difficulty)
      const lost = gap >= 5 ? 3 : gap >= 3 ? 2 : 1
      api.loseActions?.(inv.seat, lost)
      api.info?.(`🙈 「被迫藏身」：${inv.name} 意志检定失败（差值 ${gap}），失去 ${lost} 个行动。`)
    })
    return false
  },
}
