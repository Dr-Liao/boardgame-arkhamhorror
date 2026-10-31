// 06220 地点「黑暗月核」（The Black Core · [[洞穴]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：X 为黑暗月核上的深度标记数量（隐藏值 X）。
// 强制 - 黑暗月核揭示后：在其上放置 3 资源作为深度标记，再加上额外 3[per_investigator] 个深度标记。
// [action]：检定意志（2）或战斗（2）来游过月核的黑水湖。你检定成功且每超过难度 1 点，
// 移除黑暗月核的 1 个深度标记。
// 背面：通往月球核心的道路漫长而曲折。月下洞穴（暗面）上有线索时，你不能进入黑暗月核。
//
// 依据 Haskell Location/Cards/.../TheBlackCore.hs（placeTokens Depth (3+n)、chooseOne willpower/combat、
// PassedThisSkillTestBy → removeTokens）：深度标记用 api.markLocationCounter 的 'depthTokens' 键，
// 隐藏值修正与进入限制由 behavior.locationShroudModifier / behavior.investigatorEntryError 读本条目数据。
const BLACK_CORE = '06220'
const CAVERNS_DARK = '06219'
const DEPTH = 'depthTokens'

const depthOf = location => Number(location?.[DEPTH]) || 0

export default {
  code: BLACK_CORE,
  scope: 'location',
  implemented: true,
  locationRule: {
    // 隐藏值 = 深度标记数（印刷 X）；definition 里印刷 shroud 置 0。
    depthCounterKey: DEPTH,
    // 月下洞穴（暗面）有线索时不能进入黑暗月核。
    entryErrorBlockedWhileOtherHasClues: { locationCode: CAVERNS_DARK },
    onReveal(state, location, api) {
      const amount = 3 + 3 * Math.max(1, Number(state.numInvestigators) || 1)
      api.markLocationCounter?.(location.id, DEPTH, amount)
      api.info?.(`🕳️ 黑暗月核揭示后放置 ${amount} 个深度标记（3 + 3[per_investigator]）。`)
      return true
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (depthOf(location) <= 0) return
      moves.push({
        action: 'scenarioAction',
        rule: 'tshBlackCoreSwim',
        actions: 1,
        label: `🕳️ 黑暗月核：检定意志/战斗（2），每超过难度 1 点移除 1 个深度标记（剩 ${depthOf(location)}）`,
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshBlackCoreSwim') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      if (!location || depthOf(location) <= 0) return false
      const skill = api.choice?.({
        kind: 'skill', source: BLACK_CORE, seat: inv.seat,
        prompt: '选择检定技能：意志（2）或战斗（2）。',
        options: [{ id: 'willpower', label: '意志（2）' }, { id: 'combat', label: '战斗（2）' }],
      }) === 'combat' ? 'combat' : 'willpower'
      api.test?.(inv.seat, skill, 2, result => {
        if (!result.success) return
        const removed = Math.max(0, (Number(result.value) || 0) - 2)
        if (!removed) return
        api.markLocationCounter?.(location.id, DEPTH, -removed)
        api.info?.(`🕳️ 黑暗月核：${inv.name} 游过黑水湖，移除 ${removed} 个深度标记（剩 ${depthOf(location)}）。`)
      })
      return true
    },
  },
}
