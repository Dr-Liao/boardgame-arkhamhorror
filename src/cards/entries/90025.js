import { roundActionCount } from '../../engine/action-history.js'
import { assetRegulationEnabled } from '../../engine/card-text.js'
import { enemyInEngagement, enemyIsPart } from '../../engine/enemy-parts.js'

function engagedCount(state, inv) {
  return state.enemies.filter(enemy => {
    if (enemy.defeated || enemy.removedFromGame || enemyIsPart(enemy)) return false
    if (enemy.engagedSeat === inv.seat) return true
    const blank = enemy.textBlanked
    if (enemy.exhausted || (blank?.round === state.round && blank.phase === state.phase)) return false
    return enemyInEngagement(state, enemy, inv)
  }).length
}

export default {
  code: '90025',
  trackRoundActionHistory: true,
  assetRule: { regulationAction: 'fight' },
  modifiers: [{
    target: 'capability:fight',
    condition: { when: ({ state, inv, source }) => assetRegulationEnabled(state, inv, source)
      && roundActionCount(state, inv, 'fight') >= 2 },
  }],
  abilities: [{
    kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'], duringOwnSkillTest: true,
    label: '按交战敌人数提高检定值',
    cost: { exhaust: true },
    criteria: ({ state, inv }) => ['investigate', 'evade', 'parley'].includes(state.skillTest?.actionKind)
      && engagedCount(state, inv) > 0,
    resolve: ({ state, inv, api }) => api.addPendingTestBonus(2 * engagedCount(state, inv)),
  }],
}
