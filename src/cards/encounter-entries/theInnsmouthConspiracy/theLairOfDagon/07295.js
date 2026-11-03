// Each test resolves independently and inflicts one assignable damage on failure.
export default {
  code: '07295', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    const step = state.actIndex + 1
    const tests = [['agility', 3], ...(step >= 2 ? [['combat', 2]] : []), ...(step >= 3 ? [['intellect', 2]] : [])]
    for (const [skill, difficulty] of tests) {
      if (state.investigators[inv.seat].defeated || state.investigators[inv.seat].resigned) break
      api.test(inv.seat, skill, difficulty, result => {
        if (!result.success) api.damage(inv.seat, 1)
      })
    }
    return false
  },
}
