import { hasTrait } from '../../_shared.js'

const eligible = (source, unengaged) => enemy => enemy.id !== source.id
  && !enemy.exhausted && hasTrait(enemy, 'Deep One') && unengaged(enemy)

export default {
  code: '07255', scope: 'enemy',
  abilities: [{
    kind: 'forced', trigger: 'enemyEngaged', label: '深潜者幼体交战后：失去1行动，或令其攻击你',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => source.id === context.enemy?.id && inv.seat === context.seat,
    resolve: ({ inv, source, api }) => {
      const options = [
        ...(inv.actionsLeft > 0 ? [{ id: 'loseAction', label: '失去1行动' }] : []),
        { id: 'attack', label: '深潜者幼体攻击你' },
      ]
      const answer = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: '07255', seat: inv.seat, prompt: '选择深潜者幼体交战后的效果。', options,
      })
      if (answer === 'loseAction') api.scenario.loseActions(inv.seat, 1)
      else api.scenario.attack(source, inv)
    },
  }, {
    kind: 'forced', trigger: 'defeatEnemy', label: '深潜者幼体被击败后：最近的另一名未交战且准备就绪的深潜者向你移动1步',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context, helpers }) => source.id === context.enemy?.id
      && inv.seat === context.seat
      && helpers.nearestEnemies(inv.location, { predicate: eligible(source, helpers.isEnemyUnengaged) }).length > 0,
    resolve: ({ inv, source, api }) => {
      const runtime = api.scenario
      const candidates = runtime.nearestEnemies(inv.location, { predicate: eligible(source, runtime.isEnemyUnengaged) })
      if (!candidates.length) return
      const id = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'enemy', source: '07255', seat: inv.seat, prompt: '选择最近的另一名准备就绪且未交战的深潜者。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = candidates.find(enemy => enemy.id === id)
      if (enemy) runtime.moveEnemyToward(enemy, inv.location, { ignoreAloof: true, source: '07255' })
    },
  }],
}
