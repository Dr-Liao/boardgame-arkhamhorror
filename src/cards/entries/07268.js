import { enemyCanEnterLocation } from '../../engine/enemy-entry.js'
function destinations(state, enemy) {
  if (enemy.immobile) return []
  return state.locations.filter(location => state.locations.find(here => here.id === enemy.location)?.connections?.includes(location.id)
    && !location.barricade && enemyCanEnterLocation(state, enemy, location.id))
}
function canUse(state, enemy) {
  return !enemy.elite && (destinations(state, enemy).length > 0
    || enemy.damage > 0 && state.enemies.some(other => other.id !== enemy.id && other.location === enemy.location))
}
export default { code: '07268', chooseResourceCostOnPlay: true, abilities: [
  { kind: 'entersPlay', label: '封印至多 X 枚诅咒',
    resolve: ({ inv, source, api }) => api.playerTools.sealVariableCost(inv.seat, source.id, 'curse') },
  { kind: 'action', label: '横置并释放 1 诅咒：移动非精英敌人或使其对另一个敌人造成伤害',
    cost: { action: true, exhaust: true }, noOpportunityAttack: true,
    criteria: ({ state, source }) => (state.chaos?.sealed || []).some(item => item.source === source.id && item.token === 'curse'),
    target: { kind: 'enemy', query: ({ state, candidate }) => canUse(state, candidate.entity) },
    resolve: ({ state, inv, source, target, api }) => {
      if (api.chaosTokens.release(source.id, 'curse', 1) !== 1) return
      const enemy = target.entity, places = destinations(state, enemy)
      const victims = enemy.damage > 0 ? state.enemies.filter(other => other.id !== enemy.id && other.location === enemy.location) : []
      const options = [...places.map(location => ({ id: `move:${location.id}`, label: `移动至 ${location.name}` })),
        ...victims.map(other => ({ id: `damage:${other.id}`, label: `对 ${other.name} 造成 ${enemy.damage} 伤害` }))]
      if (!options.length) return
      const answer = api.choice({ kind: 'target', source: '07268', seat: inv.seat, prompt: '选择这名敌人移动，或对另一个敌人造成伤害。', options })
      if (answer.startsWith('move:')) api.moveEnemy(enemy, answer.slice(5))
      else api.damageEnemy(victims.find(other => other.id === answer.slice(7)), enemy.damage, inv.seat, { code: enemy.originalCode || enemy.code, enemyId: enemy.id })
    } },
] }
