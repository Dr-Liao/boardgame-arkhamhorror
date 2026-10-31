// 06297 冷原隐修院（Monastery of Leng）
// 卡面：[fast] 位于冷原隐修院的调查员共同花费 1[per_investigator] 个线索：
//       记住调查员「靠近了祭司」。
// 未揭示面：隐修院的门被封起来了。你不能进入冷原隐修院。
//
// 行为位置：
//   · 「未揭示不可进入」→ `locationRule.blockedWhileUnrevealed`，章节 behavior.moveError / movementError 读；
//   · [fast] 行动 → locationRule.actions / performAction（章节 behavior.actions / performAction 转发），
//     团队共同线索用 api.payClues（groupPayment 同源），「记住」= scenarioFlags.maneuveredThePriestCloser。
const CLUE_RULE = 'maneuverPriestCloser'

const activeInvestigators = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const perPlayer = state => Math.max(1,
  Number(state?.numInvestigators) || activeInvestigators(state).length || 1)
const remembered = state => state?.scenarioFlags?.maneuveredThePriestCloser === true
const cluesHere = (state, locationId) => activeInvestigators(state)
  .filter(inv => inv.location === locationId)
  .reduce((sum, inv) => sum + (inv.clues || 0), 0)

export default {
  code: '06297',
  scope: 'location',
  implemented: true,
  locationRule: {
    blockedWhileUnrevealed: true,
    actions({ moves, state, inv, location }) {
      if (!location || inv.location !== location.id) return
      if (remembered(state)) return
      const required = perPlayer(state)
      if (cluesHere(state, location.id) < required) return
      moves.push({
        action: 'scenarioAction', rule: CLUE_RULE, actions: 0, fast: true,
        label: `🕯️ 位于冷原隐修院的调查员共同花费 ${required} 个线索：记住「靠近了祭司」`,
      })
    },
    performAction(state, inv, move, api) {
      if (move?.rule !== CLUE_RULE) return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      if (!location || remembered(state)) return false
      const required = perPlayer(state)
      if (cluesHere(state, location.id) < required) return false
      api.payClues?.(required, location.id)
      api.setScenarioFlag?.('maneuveredThePriestCloser', true)
      api.info?.(`🕯️ 调查员们靠近了不可描述的高阶祭司。`)
      return true
    },
  },
}
