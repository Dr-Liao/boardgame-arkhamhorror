import { shortestPaths } from '../../engine/map-graph.js'

const targets = (state, inv) => state.enemies.filter(enemy => {
  const path = shortestPaths(state.locations, inv.location, enemy.location)[0]
  return path && path.length <= 3
})
export default {
  code: '07109', playCondition: [({ state, inv }) => targets(state, inv).length > 0],
  abilities: [{ kind: 'played', countsAs: 'engage', label: '移动至最多 2 个地点远的敌人，与其交战并加入祝福',
    resolve: ({ state, inv, api }) => {
      const candidates = targets(state, inv)
      if (!candidates.length) return
      const id = candidates.length === 1 ? candidates[0].id : api.choice({ kind: 'enemy', seat: inv.seat, source: '07109',
        prompt: '选择最多 2 个地点远的敌人。', options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
      const enemy = candidates.find(other => other.id === id)
      const destination = enemy.location, horror = enemy.horror || 0
      while (inv.location !== destination && !inv.defeated && !inv.resigned) {
        const paths = api.map.paths(inv.location, destination)
        const steps = [...new Set(paths.map(path => path[1]).filter(Boolean))]
        if (!steps.length) break
        const next = steps.length === 1 ? steps[0] : api.choice({ kind: 'location', source: '07109', seat: inv.seat,
          prompt: '选择最短路线的下一步。', options: steps.map(id => ({ id, label: api.locName(id) })) })
        const before = inv.location
        api.moveInvestigator(inv.seat, next)
        if (before === inv.location) break
      }
      if (state.enemies.includes(enemy) && inv.location === enemy.location) api.engage(enemy, inv.seat)
      api.chaosTokens.add('bless', horror)
    } }],
}
