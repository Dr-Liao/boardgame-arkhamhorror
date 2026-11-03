const inThreat = ({ controller, source }) => Boolean(controller?.threat?.some(card => card.id === source.id))

export default {
  code: '07257', scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    let placed = false
    const difficulty = api.mechanics.water.effectiveLevel(inv.seat) > 0 ? 4 : 2
    api.test(inv.seat, 'combat', difficulty, result => {
      if (result.success) return
      api.damage(inv.seat, 1)
      if (!state.investigators[inv.seat].defeated && !state.investigators[inv.seat].resigned) {
        placed = Boolean(api.threat(inv.seat, '07257'))
      }
    })
    return placed
  },
  modifiers: [
    { target: 'capability:drawCards', condition: { when: inThreat } },
    { target: 'capability:gainResources', condition: { when: inThreat } },
  ],
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds', label: '敌人阶段结束：弃掉咸潮之吻',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source }) => inv.threat.some(card => card.id === source.id),
    resolve: ({ source, api }) => api.removeThreat(source),
  }],
}
