// 06180 地点「卧室」（Bedroom · 背面「楼上的门道」Upstairs Doorway）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// [action] [action]：弃掉你威胁区域的所有非弱点诡计卡牌。
// [fast] 位于卧室的调查员共同花费 1[per_investigator] 个线索：记住调查员「找到了破碎的镜子」。
//
// 依据 Haskell Location/Cards/.../UpstairsDoorwayBedroom.hs：
//   · [action][action] 清威胁区 → locationRule.actions（actions: 2）+ performAction；
//     逐张走 api.removeThreat（唯一写入口）；
//   · [fast] 团队线索行动 → actions/performAction，事实记入 scenarioFlags.remembered（rememberFact）。
import { ALL_CARDS, activeInvestigators, originalOf, rememberFact } from '../../_shared.js'

const BEDROOM = '06180'
const FACT = 'foundACrackedMirror'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

const isWeakness = card => ['weakness', 'basicweakness'].includes(ALL_CARDS[originalOf(card)]?.subtype)

export default {
  code: BEDROOM,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      const treacheries = (inv.threat || []).filter(card => !isWeakness(card))
      if (treacheries.length) {
        moves.push({
          action: 'scenarioAction',
          rule: 'tshBedroomClearThreats',
          actions: 2,
          label: `🛏️ 卧室：弃掉你威胁区域的 ${treacheries.length} 张非弱点诡计（2 个行动）`,
        })
      }
      if ((state.scenarioFlags?.remembered || []).includes(FACT)) return
      const required = state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'tshRememberCrackedMirror',
        actions: 0,
        fast: true,
        label: `🪞 卧室：共同花费 ${required} 个线索，记住「找到了破碎的镜子」`,
        ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'tshBedroomClearThreats') {
        const treacheries = (inv.threat || []).filter(card => !isWeakness(card))
        if (!treacheries.length) return false
        for (const card of treacheries) api.removeThreat?.(card)
        api.info?.(`🛏️ 卧室：${inv.name} 弃掉了威胁区域的 ${treacheries.length} 张非弱点诡计。`)
        return true
      }
      if (move.rule === 'tshRememberCrackedMirror') {
        const location = (state.locations || []).find(item => item.id === inv.location)
        const required = state.numInvestigators
        if (!location || groupCluesAt(state, location) < required) return false
        api.payClues?.(required, location.id)
        rememberFact(state, FACT)
        api.info?.('🪞 卧室：调查员记住了「找到了破碎的镜子」（不可名状之物 -1 攻击 / -1 躲避）。')
        return true
      }
      return false
    },
  },
}
