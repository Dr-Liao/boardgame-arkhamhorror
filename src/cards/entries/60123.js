import { enemyIsBody, enemyIsPart } from '../../engine/enemy-parts.js'
import { roadDistance } from '../../engine/map-graph.js'

const code = '60123'
const targets = ({ state, inv }) => state.enemies.filter(enemy =>
  !enemy.elite && !enemy.massive && !enemy.defeated && !enemy.removedFromGame && !enemy.enemyLocation
  && !enemyIsBody(enemy) && !enemyIsPart(enemy) && roadDistance(state.locations, inv.location, enemy.location) <= 2)

const canPlay = ({ state, inv, helpers }) => targets({ state, inv }).some(enemy =>
  enemy.location !== inv.location
  || (enemy.engagedSeat !== inv.seat && !helpers.capabilityBlocked(inv.seat, 'engage'))
  || (!helpers.capabilityBlocked(inv.seat, 'fight') && !helpers.entityRuleActive(enemy, 'cannot:beAttacked')
    && (!enemy.aloof || enemy.engagedSeat != null)))

export default {
  code,
  playCondition: [canPlay],
  abilities: [{
    kind: 'played', fast: true, countsAs: 'fight', additionalActionKinds: ['engage'],
    label: '把两连接内的非精英敌人拉到所在地，然后交战并攻击',
    resolve: ({ state, inv, api }) => {
      const options = targets({ state, inv })
      if (!options.length) return
      const id = options.length === 1 ? options[0].id : api.choice({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择要拉近的敌人。',
        options: options.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = options.find(item => item.id === id)
      if (!enemy) return
      if (enemy.location !== inv.location) api.moveEnemy(enemy, inv.location)
      if (!state.enemies.includes(enemy) || enemy.location !== inv.location) return
      api.engage(enemy, inv.seat)
      if (state.enemies.includes(enemy)) {
        api.fight(inv.seat, enemy.id, { sourceCode: code, noSpend: true })
      }
    },
  }],
}
