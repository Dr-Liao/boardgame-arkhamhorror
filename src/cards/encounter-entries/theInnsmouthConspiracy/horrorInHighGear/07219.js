export default {
  code: '07219',
  scope: 'treachery',
  encounterResolve(state, inv, card, api) {
    if (api.resolveHunterMoves({ source: card.id || '07219' }).moved) return false
    const columns = state.scenarioFlags.mechanics.road.columns
    const roads = state.locations.filter(loc => Number.isFinite(columns[loc.id]))
    const minimum = Math.min(...roads.map(loc => columns[loc.id]))
    const rearmost = roads.filter(loc => columns[loc.id] === minimum)
    if (!rearmost.length) throw new Error('No actual rearmost Road location')
    const found = api.discardUntilEnemyTrait('Vehicle')
    if (!found) return false
    const id = rearmost.length === 1 ? rearmost[0].id : api.choose({
      kind: 'location', source: card.id || '07219', seat: api.decideSeat(),
      prompt: '选择最后方的地点生成追赶的载具敌人。',
      options: rearmost.map(loc => ({ id: loc.id, label: loc.name || loc.id })),
    })
    api.spawn(found, id)
    return false
  },
}
