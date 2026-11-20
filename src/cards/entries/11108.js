const code = '11108'

function historyThisTurn(state, inv) {
  return inv.actionHistory?.turn === state.turnSerial ? inv.actionHistory.entries : []
}

function threeDifferentActions(history) {
  if (history.length < 3) return false
  const [first, second, third] = history.slice(-3)
  return first.some(a => second.some(b => a !== b && third.some(c => c !== a && c !== b)))
}

const actionOptions = history => ({ excludeActionKinds: [...new Set(history.flat())] })

export default {
  code,
  limitPerInvestigator: true,
  trackActionHistory: true,
  abilities: [{
    kind: 'reaction', trigger: 'performedAction',
    cost: { exhaust: true },
    label: '连续做出三种不同行动后：横置，额外进行一种本回合尚未做过的行动',
    criteria: ({ state, inv, context, helpers }) => {
      if (context.seat !== inv.seat || state.currentSeat !== inv.seat || inv.turnEnded) return false
      const history = historyThisTurn(state, inv)
      return threeDifferentActions(history) && helpers.hasImmediateAction(inv.seat, actionOptions(history))
    },
    resolve: ({ state, inv, api }) => {
      api.performImmediateAction(inv.seat, code, actionOptions(historyThisTurn(state, inv)))
    },
  }],
}
