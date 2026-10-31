// 06217 地点「月蜥神庙」（Temple of the Moon Lizard · [[月面]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// [action]：检定意志（5）以躲在禁闭的神庙里。如果你检定成功，你的警报等级下降 1 级。（每场游戏仅限 1 次成功。）
// 强制 - 在你发现月蜥神庙的任意数量的线索后：你必须受到相同数量的恐惧，或弃掉相同数量的手牌。
//
// 依据 Haskell Location/Cards/.../TempleOfTheMoonLizard.hs（hasUsedSuccess、DiscoverClues #after → 二选一）：
//   · 隐藏成功一次/局 → scenarioFlags 标记；
//   · 「发现线索后」→ behavior.cluesGained 分派 locationRule.onCluesDiscovered（api.horror / api.discardChosen）；
//     发现事件以 (seat, round, turnSerial, amount) 幂等去重，避免同一发现被两处钩子重复结算。
import { isWeaknessCode } from '../../_shared.js'

const ALARM = 'alarmLevel'
const TEMPLE = '06217'

export default {
  code: TEMPLE,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.templeHideSuccess) return
      moves.push({
        action: 'scenarioAction',
        rule: 'tshTempleHide',
        actions: 1,
        label: '🏛️ 月蜥神庙：检定意志（5），成功则警报等级 -1（每场游戏仅限 1 次成功）',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshTempleHide') return false
      if (state.scenarioFlags?.templeHideSuccess) return false
      api.test?.(inv.seat, 'willpower', 5, result => {
        if (!result.success) return
        api.counters.add(inv.seat, ALARM, -1)
        api.setScenarioFlag?.('templeHideSuccess', true)
        api.info?.(`🏛️ 月蜥神庙：${inv.name} 躲进禁闭的神庙，警报等级 -1（本场游戏不再可用）。`)
      })
      return true
    },
    onCluesDiscovered(state, inv, amount, api) {
      if (!(amount > 0)) return
      // 同一发现事件可能由引擎两处钩子各报一次：用 (seat, round, turnSerial, amount) 幂等。
      const seen = state.scenarioFlags?.templeDiscoverySeen
      const stamp = { seat: inv.seat, round: state.round, turnSerial: state.turnSerial ?? null, amount }
      if (seen && seen.seat === stamp.seat && seen.round === stamp.round
        && seen.turnSerial === stamp.turnSerial && seen.amount === stamp.amount) return
      api.setScenarioFlag?.('templeDiscoverySeen', stamp)
      const discardable = (inv.hand || []).filter(code => !isWeaknessCode(code))
      const options = [{ id: 'horror', label: `受到 ${amount} 点恐惧` }]
      if (discardable.length >= amount) options.push({ id: 'discard', label: `弃掉 ${amount} 张手牌` })
      const answer = options.length === 1 ? options[0].id : api.choice?.({
        kind: 'cost', source: TEMPLE, seat: inv.seat,
        prompt: `月蜥神庙：必须受到 ${amount} 点恐惧，或弃掉 ${amount} 张手牌。`, options,
      })
      if (answer === 'discard') {
        api.discardChosen?.(inv.seat, amount, TEMPLE)
        api.info?.(`🏛️ 月蜥神庙：${inv.name} 弃掉 ${amount} 张手牌。`)
      } else {
        api.horror?.(inv.seat, amount)
        api.info?.(`🏛️ 月蜥神庙：${inv.name} 受到 ${amount} 点恐惧。`)
      }
    },
  },
}
