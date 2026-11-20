import { enumerateTargets } from '../../engine/targets.js'
import { ALL_CARDS } from '../cards-data.js'

const code = '11056'
const target = {
  kind: 'enemy',
  query: ({ entity, canDamageEnemy, enemyHealth }) => enemyHealth(entity) > (entity.damageTaken || 0)
    && (entity.elite ? canDamageEnemy(entity, code) : !entity.enemyLocation
      && !ALL_CARDS[entity.originalCode || entity.code]?.subtype),
}
const targetsAt = (state, inv, forbidden) => enumerateTargets(state, inv, target, { source: { code } })
  .filter(({ entity }) => !forbidden(entity))

export default {
  code,
  playCondition: [({ state, inv, helpers }) => targetsAt(state, inv,
    enemy => helpers.parleyForbidden(inv.seat, enemy)).length > 0],
  abilities: [
    {
      kind: 'played', countsAs: 'parley',
      label: '谈判：检定战斗，难度为敌人的剩余生命。成功时将非精英洗回遭遇牌库，或对精英造成 2 点伤害',
      resolve: ({ state, inv, api }) => {
        const targets = targetsAt(state, inv, enemy => api.parleyForbidden(inv.seat, enemy))
        if (!targets.length) return
        const id = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'enemy', source: code, seat: inv.seat, prompt: '选择要威吓的敌人。',
          options: targets.map(({ id, label }) => ({ id, label })),
        })
        const enemy = targets.find(item => item.id === id)?.entity
        if (!enemy) return
        api.test(inv.seat, 'combat', api.enemyHealth(enemy) - (enemy.damageTaken || 0), {
          actionKind: 'parley', source: { type: 'event', code, label: '谈判', enemyId: id },
          resolve: result => {
            if (!result.success || !api.isEnemyInPlay(enemy)) return
            if (enemy.elite) api.damageEnemy(enemy, 2, inv.seat, code)
            else api.shuffleEnemyIntoEncounterDeck(enemy, { seat: inv.seat })
          },
        })
      },
    },
  ],
}
