// 06186 地点「神秘阶梯」（Mysterious Stairs · [[墓地]]）· 万千骇形（186）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：神秘阶梯与其上方和下方的地点连接。
// 强制 - 在本地点揭示时：在其上放置 1[per_investigator] 资源。本地点上有资源时，
// 位于本地点的调查员不能移动，也不能撤退。
// [action]：检定你技能值最低的技能（2）。如果你检定成功，弃掉本地点的 1 资源。
//
// 依据 Haskell Location/Cards/.../MysteriousStairs_186.hs（PlaceResources / mins 技能选择 / RemoveResources）：
//   · 地点上的资源 → api.markLocationCounter(locationId, 'resources', n)（唯一写入口）；
//   · 技能值最低的技能：从引擎技能值里取最小值（只读）；
//   · 线索锁数据 blockWhileLocationCounter，behavior.moveError / actionBlocked 读。
const MYSTERIOUS_STAIRS = '06186'
const SKILLS = ['willpower', 'intellect', 'combat', 'agility']
const RESOURCE_KEY = 'resources'

const resourceCountOf = location => Number(location?.[RESOURCE_KEY]) || 0
const skillValue = (inv, skill) => Number(inv?.[skill] ?? inv?.skills?.[skill] ?? 0)
const lowestSkill = inv => SKILLS.reduce((best, skill) => (skillValue(inv, best) <= skillValue(inv, skill) ? best : skill), SKILLS[0])

export default {
  code: MYSTERIOUS_STAIRS,
  scope: 'location',
  implemented: true,
  locationRule: {
    blockWhileLocationCounter: {
      key: RESOURCE_KEY,
      move: true,
      resign: true,
      message: '「神秘阶梯」上还有资源：位于本地点的调查员不能移动或撤退。',
    },
    onReveal(state, location, api) {
      const amount = Math.max(1, Number(state.numInvestigators) || 1)
      api.markLocationCounter?.(location.id, RESOURCE_KEY, amount)
      api.info?.(`🪜 神秘阶梯：揭示后在其上放置 ${amount} 个资源（1[per_investigator]）。`)
      return true
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (resourceCountOf(location) <= 0) return
      const skill = lowestSkill(inv)
      moves.push({
        action: 'scenarioAction',
        rule: 'tshStairsClearResource',
        actions: 1,
        label: `🪜 神秘阶梯：检定最低技能「${skill}」（2），成功弃掉 1 资源（剩 ${resourceCountOf(location)}）`,
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshStairsClearResource') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      if (!location || resourceCountOf(location) <= 0) return false
      const skill = lowestSkill(inv)
      api.test?.(inv.seat, skill, 2, result => {
        if (!result?.success) return
        api.markLocationCounter?.(location.id, RESOURCE_KEY, -1)
        api.info?.(`🪜 神秘阶梯：${inv.name} 检定成功，弃掉 1 个资源（剩 ${resourceCountOf(location)}）。`)
      })
      return true
    },
  },
}
