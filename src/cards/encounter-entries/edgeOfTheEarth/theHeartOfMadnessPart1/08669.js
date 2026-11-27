// 08669 原质团：仅追猎持有封印的调查员，激活封印会让它再结算一次敌人阶段。
import { sealsOf } from '../../_shared.js'

const code = '08669'
const outerRing = ['facility1', 'facility2', 'facility3', 'facility14', 'facility15']
const hasSeal = (state, seat, active = false) => sealsOf(state).some(seal =>
  seal.locationId == null && seal.placedBySeat === seat && (!active || seal.active))

export default {
  code, scope: 'enemy', implemented: true,
  enemyRule: {
    onlyPrey: (state, inv) => hasSeal(state, inv.seat),
    spawnLocation: (state, { location, seat }, api) => {
      const reachable = state.locations.filter(site => outerRing.includes(site.id))
        .map(site => ({ id: site.id, distance: api.mechanics.map.distance(location, site.id) }))
        .filter(site => Number.isFinite(site.distance))
      if (!reachable.length) return null
      const farthest = Math.max(...reachable.map(site => site.distance))
      const targets = reachable.filter(site => site.distance === farthest)
      return targets.length === 1 ? targets[0].id : api.choice({ kind: 'location', source: code, seat,
        prompt: '选择离抽牌者最远的外环地点。', options: targets.map(site => ({ id: site.id, label: api.locName(site.id) })),
      })
    },
  },
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '如果有调查员控制激活封印：重整并再次结算原质团的敌人阶段',
    limit: { scope: 'perPhase', owner: 'instance' },
    criteria: ({ state }) => state.investigators.some(inv =>
      !inv.defeated && !inv.resigned && hasSeal(state, inv.seat, true)),
    resolve: ({ source, api }) => {
      api.scenario.readyEnemy(source)
      api.scenario.resolveEnemyPhaseOf(source)
    },
  }],
}
