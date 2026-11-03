const curses = state => (state.chaosBag || []).filter(token => token === 'curse').length
export default {
  code: '07263', playCondition: [({ state, inv }) => state.phase === 'investigation' && state.currentSeat === inv.seat],
  playCostModifier: ({ state }) => -curses(state),
  abilities: [
    { kind: 'played', fast: true, label: '本轮每项技能 +3', resolve: ({ inv, api }) => api.addEffect({ duration: 'endOfRound',
      sourceCode: '07263', controllerSeat: inv.seat, modifiers: [{ target: 'skill:*', amount: 3 }] }) },
  ],
}
