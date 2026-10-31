// 06216 地点「漆黑深坑」（The Dark Crater · [[月面]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [action]：检定智力（5）以躲在坑里。如果你检定成功，你的警报等级下降 1 级。（每场游戏仅限 1 次成功。）
// 强制 - 当你回合结束时，如果你位于漆黑深坑，并且你在本回合发现了其上的至少 1 个线索：检定意志（3）。
// 如果你检定失败，你的警报等级提高 1 级。
//
// 依据 Haskell Location/Cards/.../TheDarkCrater.hs（hasUsedSuccess 元数据、DiscoveredCluesThisTurn、TurnEnds）：
//   · 一次/局的隐藏成功 → scenarioFlags 里的本地点标记（api.setScenarioFlag 读写，不写地点实例字段）；
//   · 回合内发现线索的记录 → behavior.cluesGained 分派 locationRule.onCluesDiscovered（记
//     { seat, round, turnSerial }）；
//   · 回合结束强制 → behavior.turnEnded 分派 locationRule.forced.turnEnd。
const ALARM = 'alarmLevel'
const DARK_CRATER = '06216'

const discoveryFlag = state => state.scenarioFlags?.darkCraterClueTurn || null

export default {
  code: DARK_CRATER,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.darkCraterHideSuccess) return
      moves.push({
        action: 'scenarioAction',
        rule: 'tshDarkCraterHide',
        actions: 1,
        label: '🕳️ 漆黑深坑：检定智力（5），成功则警报等级 -1（每场游戏仅限 1 次成功）',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshDarkCraterHide') return false
      if (state.scenarioFlags?.darkCraterHideSuccess) return false
      api.test?.(inv.seat, 'intellect', 5, result => {
        if (!result.success) return
        api.counters.add(inv.seat, ALARM, -1)
        api.setScenarioFlag?.('darkCraterHideSuccess', true)
        api.info?.(`🕳️ 漆黑深坑：${inv.name} 躲进坑里，警报等级 -1（本场游戏不再可用）。`)
      })
      return true
    },
    // behavior.cluesGained：记录「本回合在本地点发现过线索」。
    onCluesDiscovered(state, inv, amount, api) {
      if (!(amount > 0)) return
      api.setScenarioFlag?.('darkCraterClueTurn', {
        seat: inv.seat, round: state.round, turnSerial: state.turnSerial ?? null,
      })
    },
    forced: {
      turnEnd(state, inv, location, api) {
        if (inv.location !== location.id) return
        const found = discoveryFlag(state)
        if (!found || found.round !== state.round || found.turnSerial !== (state.turnSerial ?? null)) return
        api.test?.(inv.seat, 'willpower', 3, result => {
          if (result.success) return
          api.counters.add(inv.seat, ALARM, 1)
          api.info?.(`🕳️ 漆黑深坑：${inv.name} 意志检定失败，警报等级 +1。`)
        })
      },
    },
  },
}
