// 06218 地点「月之森林」（Moon-Forest · [[月面]]·[[树林]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [action]：检定敏捷（5）以藏身在怪异的森林中。如果你检定成功，你的警报等级下降 1 级。（每场游戏仅限 1 次成功。）
// [fast] 在你回合期间（行动外）：躲避。如果你检定失败，你的警报等级提高 1 级。（每轮仅限一次。）
//
// 依据 Haskell Location/Cards/.../MoonForest.hs（hasUsedSuccess、playerLimit PerRound + FastAbility' #evade、
// FailedThisSkillTest → raiseAlarmLevel）：
//   · 隐藏成功一次/局 → scenarioFlags 标记；
//   · [fast] 躲避 = 本地点提供的免费躲避行动 → locationRule.actions（actions:0, fast:true）+ performAction；
//     目标敌人与难度取引擎数值（enemy.evade），成功走 api.evadeEnemy（引擎的自动躲避结算）。
import { teamOnce } from '../../_shared.js'

const ALARM = 'alarmLevel'
const MOON_FOREST = '06218'

// 只读判定「本轮是否已用 [fast] 躲避」——actions() 不能写状态（会被合法动作枚举反复调用）。
const usedThisRound = (state, seat) => Boolean(state.scenarioFlags?.teamOnce?.[`moonForestEvade:${seat}:${state.round}:r`])

export default {
  code: MOON_FOREST,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (!state.scenarioFlags?.moonForestHideSuccess) {
        moves.push({
          action: 'scenarioAction',
          rule: 'tshMoonForestHide',
          actions: 1,
          label: '🌲 月之森林：检定敏捷（5），成功则警报等级 -1（每场游戏仅限 1 次成功）',
        })
      }
      const enemies = (state.enemies || []).filter(enemy => enemy.location === location.id && !enemy.defeated)
      if (!enemies.length) return
      moves.push({
        action: 'scenarioAction',
        rule: 'tshMoonForestEvade',
        actions: 0,
        fast: true,
        label: '🌲 月之森林：[fast] 躲避一个敌人；失败则警报等级 +1（每轮仅限一次）',
        ...(usedThisRound(state, inv.seat) ? { reason: '本轮已经用月之森林的 [fast] 躲避过', used: true } : {}),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'tshMoonForestHide') {
        if (state.scenarioFlags?.moonForestHideSuccess) return false
        api.test?.(inv.seat, 'agility', 5, result => {
          if (!result.success) return
          api.counters.add(inv.seat, ALARM, -1)
          api.setScenarioFlag?.('moonForestHideSuccess', true)
          api.info?.(`🌲 月之森林：${inv.name} 藏身于怪树之间，警报等级 -1（本场游戏不再可用）。`)
        })
        return true
      }
      if (move.rule === 'tshMoonForestEvade') {
        const location = (state.locations || []).find(item => item.id === inv.location)
        const enemies = (state.enemies || []).filter(enemy => enemy.location === location?.id && !enemy.defeated)
        if (!enemies.length) return false
        // 每轮仅限一次（按调查员）：teamOnce 已登记则不再允许。
        if (!teamOnce(state, `moonForestEvade:${inv.seat}`, 'round')) {
          api.info?.('本回合/本轮已经用月之森林的 [fast] 躲避过。')
          return true
        }
        const chosen = enemies.length === 1 ? enemies[0] : enemies.find(enemy =>
          String(enemy.id) === String(api.choice?.({
            kind: 'enemy', source: MOON_FOREST, seat: inv.seat,
            prompt: '选择要躲避的敌人。',
            options: enemies.map(enemy => ({ id: String(enemy.id), label: enemy.name })),
          }))) || enemies[0]
        const difficulty = Math.max(0, Number(chosen.evade) || 0)
        api.test?.(inv.seat, 'agility', difficulty, result => {
          if (result.success) {
            api.evadeEnemy?.(chosen)
            api.info?.(`🌲 月之森林：${inv.name} 成功躲避「${chosen.name}」。`)
            return
          }
          api.counters.add(inv.seat, ALARM, 1)
          api.info?.(`🌲 月之森林：${inv.name} 躲避失败，警报等级 +1。`)
        })
        return true
      }
      return false
    },
  },
}
