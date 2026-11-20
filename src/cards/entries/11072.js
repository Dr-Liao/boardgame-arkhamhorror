import { ALL_CARDS } from '../cards-data.js'
import { enemyIsBody } from '../../engine/enemy-parts.js'
import { enemiesAt } from '../../engine/matcher.js'

const CODE = '11072'
const targets = (state, inv, forbidden) => enemiesAt(state, inv.location).filter(enemy => !enemyIsBody(enemy)
  && !enemy.defeated && !enemy.removedFromGame && !ALL_CARDS[enemy.originalCode || enemy.code]?.subtype
  && !forbidden(enemy))

export default {
  code: CODE,
  playCondition: [({ state, inv, helpers }) => targets(state, inv, enemy => helpers.parleyForbidden(inv.seat, enemy)).length > 0],
  abilities: [{
    kind: 'played', countsAs: 'parley',
    label: '谈判：选择非弱点敌人，意志检定（3 + 其恐惧值）；成功击败（精英受到 3 伤害），失败为它放置 1 毁灭',
    resolve: ({ state, inv, api }) => {
      const candidates = targets(state, inv, enemy => api.parleyForbidden(inv.seat, enemy))
      if (!candidates.length) return
      const enemyId = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择一名非弱点敌人。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = candidates.find(candidate => candidate.id === enemyId)
      api.test(inv.seat, 'willpower', 3 + (Number(enemy.horror) || 0), {
        actionKind: 'parley', source: { type: 'event', code: CODE, enemyId },
        resolve: result => {
          if (!result.success) api.placeDoomOnCard(enemy, 1)
          else if (enemy.elite) api.damageEnemy(enemy, 3, inv.seat, { code: CODE })
          else api.scenario.defeatEnemy(enemy, { seat: inv.seat, source: { code: CODE } })
        },
      })
    },
  }],
}
