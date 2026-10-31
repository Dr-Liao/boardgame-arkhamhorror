// 06299 大礼堂 / 缟玛瑙城堡（The Great Hall / The Onyx Castle）
// 未揭示面：前往缟玛瑙城堡的道路隐藏了起来。你不能进入缟玛瑙城堡。
// 揭示面（大礼堂）：[action]：选择你所在地点的另一位调查员。
//       将你手牌中的一张隐私卡牌加入所选调查员的手牌。
//
// 行为位置：
//   · 未揭示不可进入 → `locationRule.blockedWhileUnrevealed`，章节 behavior.moveError / movementError 读；
//   · [action] → locationRule.actions / performAction（章节 behavior 转发）；
//     「隐私卡牌」= hand 中的 inv.hiddenCards；移交给另一人需要 hidden 手牌移交原语
//     （已提交 primitive request；无原语时该行动只提示，记 worker 报告 simplified）。
const GIVE_RULE = 'giveHiddenCard'

const activeInvestigators = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const hiddenCardsInHand = inv => (inv?.hand || []).filter(code => (inv?.hiddenCards || []).includes(code))
const othersHere = (state, inv) => activeInvestigators(state)
  .filter(other => other.seat !== inv.seat && other.location === inv.location)

export default {
  code: '06299',
  scope: 'location',
  implemented: true,
  locationRule: {
    blockedWhileUnrevealed: true,
    actions({ moves, state, inv, location }) {
      if (!location || inv.location !== location.id) return
      if (!othersHere(state, inv).length || !hiddenCardsInHand(inv).length) return
      moves.push({
        action: 'scenarioAction', rule: GIVE_RULE, actions: 1,
        label: '🤫 大礼堂：将你手牌中的一张隐私卡牌交给同地点的另一位调查员',
      })
    },
    performAction(state, inv, move, api) {
      if (move?.rule !== GIVE_RULE) return false
      const others = othersHere(state, inv)
      if (!others.length) return false
      const hidden = hiddenCardsInHand(inv)
      if (!hidden.length) return false
      const targetSeat = others.length === 1 ? others[0].seat : Number(api.choose?.({
        kind: 'investigator', source: '06299', seat: inv.seat,
        prompt: '大礼堂：选择接收隐私卡牌的调查员。',
        options: others.map(other => ({ id: String(other.seat), label: other.name })),
      }))
      const chosenIndex = hidden.length === 1 ? 0 : Number(api.choose?.({
        kind: 'card', source: '06299', seat: inv.seat,
        prompt: '大礼堂：选择要交出的隐私卡牌。',
        options: hidden.map((code, index) => ({ id: String(index), label: api.cardName?.(code) || code })),
      }))
      const code = hidden[Number.isInteger(chosenIndex) && hidden[chosenIndex] ? chosenIndex : 0]
      if (!code) return false
      if (typeof api.transferHiddenCard !== 'function') {
        api.info?.('「大礼堂」：当前缺少移交隐私手牌的原语，本次行动未生效（记为简化）。')
        return true
      }
      api.transferHiddenCard(inv.seat, targetSeat, code)
      return true
    },
  },
}
