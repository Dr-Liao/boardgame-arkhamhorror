// 06181 地点「阁楼」（Attic）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// [fast] 位于阁楼的调查员共同花费 1[per_investigator] 个线索：在一堆怪异的骨头底下，你看到了一抹银光。
// 记住调查员「发现了一把奇怪的钥匙」。
//
// 依据 Haskell Location/Cards/.../Attic.hs：团队线索 [fast] 行动 → actions/performAction；
// 「记住」记入 scenarioFlags.remembered（rememberFact），结局 2 的分支与「无名坟墓」目标读它。
import { activeInvestigators, rememberFact } from '../../_shared.js'

const ATTIC = '06181'
const FACT = 'recoveredAStrangeKey'

const groupCluesAt = (state, location) => activeInvestigators(state)
  .filter(inv => inv.location === location.id)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

export default {
  code: ATTIC,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if ((state.scenarioFlags?.remembered || []).includes(FACT)) return
      const required = state.numInvestigators
      moves.push({
        action: 'scenarioAction',
        rule: 'tshRememberSilverKeyAttic',
        actions: 0,
        fast: true,
        label: `🗝️ 阁楼：共同花费 ${required} 个线索，记住「发现了一把奇怪的钥匙」`,
        ...(groupCluesAt(state, location) >= required ? {} : { reason: `共同线索不足（需要 ${required}）` }),
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'tshRememberSilverKeyAttic') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      const required = state.numInvestigators
      if (!location || groupCluesAt(state, location) < required) return false
      api.payClues?.(required, location.id)
      rememberFact(state, FACT)
      api.info?.('🗝️ 阁楼：调查员在怪异的骨堆下发现银光，记住了「发现了一把奇怪的钥匙」。')
      return true
    },
  },
}
