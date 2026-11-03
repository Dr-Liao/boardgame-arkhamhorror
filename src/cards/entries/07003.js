export default {
  code: '07003', kind: 'investigator', investigator: { elderSign: { bonus: 2 } },
  elderSign: { label: '旧印：+2，可在任意已揭示地点调查', resolve: ({ inv, state, api }) => {
    if (state.skillTest?.source?.label === '调查') {
      const places = state.locations.filter(loc => loc.revealed)
      const id = api.choice({ kind: 'location', seat: inv.seat, source: inv.code, canSkip: true,
        prompt: '选择改为调查的已揭示地点。', options: [{ id: 'skip', label: '保留原地点' }, ...places.map(loc => ({ id: loc.id, label: loc.name }))] })
      if (id !== 'skip') api.retargetInvestigation(id, { anyRevealed: true })
    }
    return { delta: 2 }
  } },
  abilities: [{ kind: 'reaction', trigger: 'clueDiscovered', label: '额外发现线索，或自动躲避敌人', limit: 'oncePerRound',
    criteria: ({ inv, state, context, helpers }) => context.seat === inv.seat && context.amount > 0
      && state.enemies.some(enemy => enemy.location === context.location)
      && (helpers.canDiscoverClueAt(inv.seat, context.location)
        || state.enemies.some(enemy => enemy.location === context.location && helpers.canAutoEvade(enemy, inv.seat))),
    resolve: ({ inv, state, context, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.location === context.location && api.canAutoEvade(enemy, inv.seat))
      const location = state.locations.find(loc => loc.id === context.location)
      const options = [...(location?.clues > 0 && api.canDiscoverClueAt(inv.seat, context.location) ? [{ id: 'clue', label: '发现额外 1 个线索' }] : []),
        ...enemies.map(enemy => ({ id: enemy.id, label: `自动躲避 ${enemy.name}` }))]
      if (!options.length) return
      const id = api.choice({ kind: 'effect', seat: inv.seat, source: inv.code, prompt: '选择线索或躲避。', options })
      if (id === 'clue') api.discoverClue(inv.seat, 1, context.location)
      else api.autoEvadeEnemy(id)
    } }],
}
