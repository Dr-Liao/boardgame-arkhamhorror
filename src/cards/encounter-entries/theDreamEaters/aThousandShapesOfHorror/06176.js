// 06176 地点「休息间」（Den · 背面「楼下的门道」Downstairs Doorway）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// [reaction] 你成功调查休息间后，弃掉你的 1 张手牌：发现本地点的额外 1 个线索。
// [fast] 位于休息间的调查员共同花费 1[per_investigator] 个线索：记住调查员「研究了一幅亵渎的肖像画」。
//
// 依据 Haskell Location/Cards/.../DownstairsDoorwayDen.hs：
//   · 调查成功后的可选反应 → locationRule.afterInvestigate（本章 behavior 的 afterInvestigate 分派）；
//     弃牌走 api.discardChosen，额外线索走 api.discoverClue（引擎唯一发现入口）；
//   · [fast] 团队线索行动 → actions/performAction，事实记入 scenarioFlags.remembered（rememberFact）。
import { activeInvestigators, rememberFact } from '../../_shared.js'

const DEN = '06176'
const FACT = 'studiedADesecratedPortrait'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

export default {
  code: DEN,
  scope: 'location',
  implemented: true,
  locationRule: {
    afterInvestigate(state, inv, location, result, api) {
      if (!result?.success) return
      if (inv.location !== location.id) return
      if (!(inv.hand || []).length) return
      const answer = api.choice?.({
        kind: 'reaction',
        source: DEN,
        seat: inv.seat,
        prompt: `${inv.name} 成功调查了休息间：弃掉 1 张手牌，发现 1 个额外线索？`,
        options: [
          { id: 'trigger', label: '弃掉 1 张手牌：发现本地点的额外 1 个线索' },
          { id: 'skip', label: '不触发' },
        ],
      })
      if (answer !== 'trigger') return
      api.discardChosen?.(inv.seat, 1, DEN)
      api.discoverClue?.(inv.seat, 1, location.id)
      api.info?.(`🪞 休息间：${inv.name} 弃掉 1 张手牌，发现 1 个额外线索。`)
    },
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if ((state.scenarioFlags?.remembered || []).includes(FACT)) return
      const required = state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'tshRememberDesecratedPortrait',
        actions: 0,
        fast: true,
        label: `🖼️ 休息间：共同花费 ${required} 个线索，记住「研究了一幅亵渎的肖像画」`,
        ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshRememberDesecratedPortrait') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      const required = state.numInvestigators
      if (!location || groupCluesAt(state, location) < required) return false
      api.payClues?.(required, location.id)
      rememberFact(state, FACT)
      api.info?.('🖼️ 休息间：调查员记住了「研究了一幅亵渎的肖像画」（不可名状之物 -1 攻击 / -1 躲避）。')
      return true
    },
  },
}
