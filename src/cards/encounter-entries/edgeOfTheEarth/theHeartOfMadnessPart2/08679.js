// 08679 无名疯狂 · 警戒、庞大、反击；无法受到伤害。
import { entryDistance } from '../../_shared.js'

const CODE = '08679'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyRule: { cannotBeDamaged: true },
  flags: { namelessMadness: true, alert: true, massive: true, retaliate: true },
  abilities: [{
    kind: 'forced', trigger: 'testEnds',
    label: '成功攻击或躲避无名疯狂：每超过难度 1 点，横置最近的一份重整副本',
    criteria: ({ state, source, context }) => {
      const test = state.skillTest
      return test?.target?.id === source.id && ['fight', 'evade'].includes(test.actionKind)
        && (context.result?.summary?.successBy || 0) > 0
    },
    resolve: ({ state, context, api }) => {
      const inv = state.investigators[context.seat]
      let remaining = context.result.summary.successBy
      const candidates = state.enemies.filter(enemy => (enemy.originalCode || enemy.code) === CODE
        && !enemy.exhausted && !enemy.defeated && !enemy.removedFromGame)
      while (remaining > 0 && candidates.length) {
        const distance = Math.min(...candidates.map(enemy => entryDistance(state, inv.location, enemy.location)))
        const nearest = candidates.filter(enemy => entryDistance(state, inv.location, enemy.location) === distance)
        let chosen = nearest
        if (nearest.length > remaining) {
          const id = api.choice({
            kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择要横置的最近无名疯狂。',
            options: nearest.map(enemy => ({ id: enemy.id, label: enemy.name, locationId: enemy.location })),
          })
          chosen = nearest.filter(enemy => enemy.id === id)
          if (!chosen.length) break
        }
        for (const enemy of chosen) {
          api.scenario.exhaustEnemy(enemy)
          candidates.splice(candidates.indexOf(enemy), 1)
        }
        remaining -= chosen.length
      }
    },
  }],
}
