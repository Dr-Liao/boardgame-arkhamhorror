// 06046 火焰洞穴（The Cavern of Flame）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 神话阶段结束时：位于「火焰洞穴」的每位调查员受到 1 点伤害。
//   未揭示面：除非「七十级台阶」上的全部线索都被发现，否则你不能进入「火焰洞穴」。
// 读点：entryError（引擎 engine.js#investigatorEntryError 直接读 locationRule.entryError，
//   只在地点未揭示时生效）；onMythosEnd 为章节 behavior.mythosEnded 的自定义分派（读点写在 behavior.js）。
import { activeInvestigators, originalOf } from '../../_shared.js'

const CODE = '06046'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    entryError(state, location, inv) {
      const steps = (state.locations || []).find(entry => originalOf(entry) === '06045')
      if (steps && Number(steps.clues || 0) > 0) {
        return '「火焰洞穴」：必须先发现「七十级台阶」上的全部线索，才能进入这里。'
      }
      return undefined
    },
    onMythosEnd(state, location, api) {
      const here = activeInvestigators(state).filter(inv => inv.location === location.id)
      for (const inv of here) api.damage?.(inv.seat, 1)
      if (here.length) api.info?.(`🔥 「火焰洞穴」：神话阶段结束，${here.map(inv => inv.name).join('、')} 各受到 1 点伤害。`)
    },
  },
}
