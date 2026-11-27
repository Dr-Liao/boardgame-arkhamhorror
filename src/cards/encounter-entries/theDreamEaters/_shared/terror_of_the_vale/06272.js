// 06272 巨噬蠕虫隧道（Dhole Tunnel）
import { originalOf } from '../../../_shared.js'

const DHOLE = '06271'
const TUNNEL = '06272'

function distancesFrom(locations, origin) {
  const distances = new Map([[origin, 0]])
  const queue = [origin]
  for (const current of queue) {
    for (const next of locations.get(current)?.connections || []) {
      if (!locations.has(next) || distances.has(next)) continue
      distances.set(next, distances.get(current) + 1)
      queue.push(next)
    }
  }
  return distances
}

function chooseLocation(candidates, inv, api, prompt) {
  if (candidates.length <= 1) return candidates[0]
  const id = api.choose({
    kind: 'location', source: TUNNEL, seat: inv.seat, prompt,
    options: candidates.map(location => ({ id: location.id, label: location.name })),
  })
  return candidates.find(location => location.id === id)
}

export default {
  code: TUNNEL,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const dhole = state.enemies.find(enemy => originalOf(enemy) === DHOLE && !enemy.defeated)
    if (dhole) {
      api.readyEnemy(dhole)
      api.resolveEnemyPhaseOf(dhole)
      return false
    }

    const locations = new Map(state.locations.map(location => [location.id, location]))
    const distances = distancesFrom(locations, inv.location)
    const tunnels = state.locations.filter(location => distances.has(location.id)
      && location.attachments?.some(attachment => originalOf(attachment) === TUNNEL))
    const minimum = Math.min(...tunnels.map(location => distances.get(location.id)))
    const nearest = tunnels.filter(location => distances.get(location.id) === minimum)
    const selected = chooseLocation(nearest, inv, api, '选择一处最近的巨噬蠕虫隧道。')
    const eligibleDistances = selected ? distancesFrom(locations, selected.id) : new Map()
    const candidates = state.locations.filter(location => (eligibleDistances.get(location.id) ?? 0) >= 2)
    const target = chooseLocation(candidates, inv, api, '选择与该隧道至少相距 2 条连接的地点。')
      || locations.get(inv.location)
    if (!target) return false
    const attachment = api.attachToLocation(target.id, { code: TUNNEL, originalCode: TUNNEL })
    if (!attachment) return false
    api.info?.(`🐛 「巨噬蠕虫隧道」附属到「${target.name}」。`)

    if (api.takeFromVictory(DHOLE)) api.spawn(DHOLE, target.id, { exhausted: true })
    return true
  },
}
