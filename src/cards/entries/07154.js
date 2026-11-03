import { shortestPaths } from '../../engine/map-graph.js'

const targets = (state, inv) => state.locations.filter(location => !location.revealed
  && shortestPaths(state.locations, inv.location, location.id).length > 0)
export default {
  code: '07154', playCondition: [({ state, inv }) => !state.enemies.some(enemy => enemy.engagedSeat === inv.seat)
    && targets(state, inv).length > 0],
  abilities: [{ kind: 'played', countsAs: 'move', label: '沿最短路线朝未揭示的地点移动', resolve: ({ state, inv, api }) => {
    const candidates = targets(state, inv)
    if (!candidates.length) return
    const destination = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'location', source: '07154', seat: inv.seat,
      prompt: '选择未揭示的目的地。', options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })) })
    while (inv.location !== destination && !inv.defeated && !inv.resigned) {
      const steps = [...new Set(api.map.paths(inv.location, destination).map(path => path[1]).filter(Boolean))]
      if (!steps.length) break
      const next = steps.length === 1 ? steps[0] : api.choice({ kind: 'location', source: '07154', seat: inv.seat,
        prompt: '选择最短路线的下一步。', options: steps.map(id => ({ id, label: api.locName(id) })) })
      const revealed = new Set(state.locations.filter(location => location.revealed).map(location => location.id))
      const before = inv.location
      api.moveInvestigator(inv.seat, next)
      if (before === inv.location || state.locations.some(location => location.revealed && !revealed.has(location.id))
        || state.enemies.some(enemy => enemy.engagedSeat === inv.seat)) break
    }
  } }],
}
