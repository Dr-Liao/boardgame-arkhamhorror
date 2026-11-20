import { hasTrait } from '../../engine/matcher.js'
import { enemyIgnoresInvestigator } from '../../engine/trait-passives.js'
import { skillModifier } from './_shared.js'

const creatureHere = ({ state, inv }) => state.enemies.some(enemy => enemy.location === inv.location
  && !enemy.defeated && (hasTrait(enemy, 'Creature') || hasTrait(enemy, 'Monster')))

function candidates(state, inv, canMoveTo, engageBlocked) {
  const connections = state.locations.find(location => location.id === inv.location)?.connections || []
  return state.enemies.filter(enemy => !enemy.defeated && !enemy.partOf && !enemy.enemyLocation
    && (enemy.location === inv.location
      ? enemy.engagedSeat !== inv.seat && !enemy.massive && !engageBlocked
        && !enemyIgnoresInvestigator(state, inv, enemy)
      : connections.includes(enemy.location) && canMoveTo(inv.seat, enemy.location)))
}

export default {
  code: '11110',
  modifiers: [
    skillModifier('willpower', 1, { when: creatureHere }),
    skillModifier('combat', 1, { when: creatureHere }),
  ],
  abilities: [{
    kind: 'free',
    cost: { exhaust: true },
    label: '横置：选择本地点或连接地点的敌人，移动到其地点并与之交战',
    criteria: ({ inv, state, helpers }) => candidates(state, inv, helpers.canMoveTo, helpers.capabilityBlocked('engage')).length > 0,
    resolve: ({ inv, api, state }) => {
      const targets = candidates(state, inv, api.canMoveTo, api.capabilityBlocked(inv.seat, 'engage'))
      if (!targets.length) return
      const id = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'enemy', source: '11110', seat: inv.seat, prompt: '选择要追踪的敌人。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === id)
      if (enemy.location !== inv.location) api.moveInvestigator(inv.seat, enemy.location)
      if (enemy.location === inv.location && api.isEnemyInPlay(enemy)) api.engage(enemy, inv.seat)
    },
  }],
}
