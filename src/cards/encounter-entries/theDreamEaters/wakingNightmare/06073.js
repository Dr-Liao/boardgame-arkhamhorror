// 06073 档案室（Records Office）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[action][action][action] 若你未与任何敌人交战：一次一个，进行 4 次基础调查行动。
// 读点：locationRule.actions / performAction 由章节 behavior.actions / performAction 分派。
// 实现：每次重新枚举合法基础调查行动，由调查员选择并完整结算后再进行下一次。
const CODE = '06073'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      if ((inv.engaged || []).length) return
      moves.push({
        action: 'scenarioAction',
        rule: 'recordsOfficeInvestigations',
        actions: 3,
        label: '📁 档案室：一次一个，进行 4 次基础调查行动（3 个行动）',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'recordsOfficeInvestigations') return false
      for (let index = 0; index < 4; index += 1) {
        if (inv.defeated || inv.resigned) break
        if (!api.grantedBasicInvestigate?.(inv.seat)) break
      }
      return true
    },
  },
}
