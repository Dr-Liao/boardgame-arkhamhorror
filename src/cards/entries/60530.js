export default {
  code: '60530',
  modifiers: [{
    target: 'testDifficulty',
    amount: ({ state, inv }) => {
      if (state.phase !== 'investigation' || state.currentSeat !== inv.seat || inv.turnEnded) return 0
      const actions = inv.actionsTakenThisTurn || 0
      if (actions <= 1) return 1
      if (actions >= 3) return -1
      return 0
    },
  }],
}
