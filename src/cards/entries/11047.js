import { enemyInEngagement } from '../../engine/enemy-parts.js'
import { ownSeat } from '../../engine/matcher.js'
import { attackableEnemies } from './_shared.js'

const CODE = '11047'

function performAction(kind, { state, inv, source, target, api }) {
  if (!target) return
  let testedEnemy = target.entity
  const options = {
    assetId: source.id, trackAssetSource: true, noSpend: true,
    onSuccess: ({ enemy }) => { testedEnemy = enemy },
  }
  const result = kind === 'fight'
    ? api.fight(inv.seat, target.id, options)
    : api.evade(inv.seat, { ...options, enemyId: target.id })
  if (result?.success && state.enemies.includes(testedEnemy)) api.damageEnemy(testedEnemy, 1, inv.seat, source.id)
}

export default {
  code: CODE,
  researchRequirement: 'youHaveCalculatedTheDayOfReckoning',
  researchUpgradeFrom: '11035',
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', countsAs: 'fight', label: '攻击；成功后对目标再造成 1 伤害',
      criteria: [({ helpers }) => !helpers.capabilityBlocked('fight')],
      target: { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
        !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) },
      resolve: ctx => performAction('fight', ctx),
    },
    {
      kind: 'action', countsAs: 'evade', label: '躲避；成功后对目标造成 1 伤害',
      criteria: [({ helpers }) => !helpers.capabilityBlocked('evade')],
      target: { kind: 'enemy', query: ({ state, inv, entity, enemyEvade }) =>
        enemyInEngagement(state, entity, inv) && Number.isFinite(enemyEvade(entity)) },
      resolve: ctx => performAction('evade', ctx),
    },
    {
      kind: 'reaction', trigger: 'tokenEffectWouldResolve',
      label: '花费 1 充能：取消并归还该标记，再揭示一枚',
      cost: { uses: 1 },
      criteria: [ownSeat(), ({ state, source, context }) =>
        state.skillTest?.assetSourceId === source.id && !context.cannotCancel && !context.returnAndReroll && !context.rerollToken],
      resolve: ({ inv, context, api }) => api.rerollCurrentTestToken(context, inv.seat),
    },
  ],
}
