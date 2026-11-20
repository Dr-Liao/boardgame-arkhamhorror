import { enemyCanEnterLocation } from '../../engine/enemy-entry.js'
import { enemyInEngagement, enemyIsBody } from '../../engine/enemy-parts.js'

const code = '11055'
const evadable = (state, inv) => state.enemies.filter(enemy => !enemyIsBody(enemy) && enemy.location === inv.location
  && enemyInEngagement(state, enemy, inv))

export default {
  code,
  playCondition: [({ state, inv }) => evadable(state, inv).length > 0],
  abilities: [
    {
      kind: 'played', countsAs: 'evade', label: '躲避：加上战斗；成功至少 2 点时造成 1 伤害；可移动非精英敌人',
      resolve: ({ state, inv, api }) => {
        const enemies = evadable(state, inv)
        if (!enemies.length) return
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'enemy', source: code, seat: inv.seat, prompt: '选择要躲避的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId)
        if (!enemy) return
        const result = api.evade(inv.seat, { enemyId, addSkill: 'combat', sourceCode: code })
        if (!result) return
        if (result.success && result.value - result.difficulty >= 2 && api.isEnemyInPlay(enemy)) {
          api.damageEnemy(enemy, 1, inv.seat, code)
        }
        if (enemy.elite || !api.isEnemyInPlay(enemy)) return
        const options = (api.locationById(inv.location)?.connections || [])
          .filter(id => enemyCanEnterLocation(state, enemy, id))
          .map(id => ({ id, label: api.locName(id) }))
        if (!options.length) return
        const to = api.choice({
          kind: 'move', source: code, seat: inv.seat, canSkip: true, prompt: '可以移动这个敌人到一个连接地点。',
          options: [{ id: 'skip', label: '不移动' }, ...options],
        })
        if (options.some(item => item.id === to)) api.moveEnemy(enemy, to)
      },
    },
  ],
}
