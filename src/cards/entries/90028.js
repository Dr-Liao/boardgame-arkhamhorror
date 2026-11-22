import { assetRegulationEnabled } from '../../engine/card-text.js'
import { enemyIsPart } from '../../engine/enemy-parts.js'
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '90028',
  modifiers: [{
    target: 'capability:commit',
    condition: { when: ({ state, inv, source }) => assetRegulationEnabled(state, inv, source)
      && inv.clueDiscovery?.round !== state.round
      && state.locations.some(location => location.id === inv.location && location.clues > 0) },
  }],
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '抽 1 张牌',
    cost: { exhaust: true },
    criteria: [ownSeat(), ({ state, inv }) => state.enemies.some(enemy => enemy.location === inv.location
      && !enemyIsPart(enemy) && !enemy.defeated && !enemy.removedFromGame)],
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
  }],
}
