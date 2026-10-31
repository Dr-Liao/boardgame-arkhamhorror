// 06187 地点「神秘阶梯」（Mysterious Stairs · [[墓地]]）· 万千骇形（187）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：神秘阶梯与其上方和下方的地点连接。
// 强制 - 在本地点揭示时：将不可名状之物移动到本地点。
// 不可名状之物位于本地点，且其上的伤害少于 1[per_investigator] 时，位于本地点的调查员不能移动，也不能撤退。
//
// 依据 Haskell Location/Cards/.../MysteriousStairs_187.hs：
//   · 揭示时移动不可名状之物 → locationRule.onReveal（api.moveEnemy 唯一移动写入口）；
//   · 未受伤锁 → locationRule.blockWhileUnnamableDamageBelow，behavior.moveError / actionBlocked 读。
const MYSTERIOUS_STAIRS = '06187'
const THE_UNNAMABLE = '06169b'

const isUnnamable = enemy => String(enemy?.originalCode || enemy?.code) === THE_UNNAMABLE

export default {
  code: MYSTERIOUS_STAIRS,
  scope: 'location',
  implemented: true,
  locationRule: {
    blockWhileUnnamableDamageBelow: {
      enemyCode: THE_UNNAMABLE,
      perInvestigator: 1,
      move: true,
      resign: true,
      message: '不可名状之物在这里且伤害不足：位于本地点的调查员不能移动或撤退。',
    },
    onReveal(state, location, api) {
      const unnamable = (state.enemies || []).find(isUnnamable)
      if (!unnamable) {
        api.info?.('🪜 神秘阶梯：不可名状之物不在场上，没有可移动的目标。')
        return true
      }
      if (unnamable.location === location.id) return true
      api.moveEnemy?.(unnamable, location.id)
      api.info?.(`🪜 神秘阶梯：不可名状之物被移动到本地点。`)
      return true
    },
  },
}
