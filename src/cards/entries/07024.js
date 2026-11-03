const completed = state => {
  const history = state.investigators[state.currentSeat]?.actionHistory
  return history?.turn === state.turnSerial ? history.entries.length : 0
}
export default {
  code: '07024', trackActionHistory: true,
  abilities: [{ kind: 'commit', skill: {
    iconBonus: ({ state, skill }) => {
      const n = completed(state)
      const icons = n === 0 ? ['willpower', 'agility'] : n >= 2 ? ['combat', 'intellect'] : []
      return [].concat(skill).filter(name => icons.includes(name)).length
    },
    afterTest: ({ state, inv, result, api }) => { if (completed(state) === 1 && result?.success) api.drawCards(inv.seat, 1) },
  } }],
}
