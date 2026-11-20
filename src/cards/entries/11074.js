import { ownSeat } from '../../engine/matcher.js'
import { enumerateTargets } from '../../engine/targets.js'
import { enemyInEngagement } from '../../engine/enemy-parts.js'
import { attackableEnemies, SKILL_NAMES_ZH } from './_shared.js'

const CODE = '11074'
const skilledAction = (kind, { inv, source, api }, id) => {
  const normalSkill = kind === 'fight' ? 'combat' : 'agility'
  const skill = api.choice({
    kind: 'effect', source: CODE, seat: inv.seat, prompt: '选择本次检定使用的技能。',
    options: [normalSkill, 'willpower'].map(id => ({ id, label: SKILL_NAMES_ZH[id] })),
  })
  const options = { skill, assetId: source.id, trackAssetSource: true, noSpend: true }
  return kind === 'fight' ? api.fight(inv.seat, id, { ...options, combatBonus: 1 })
    : api.evade(inv.seat, { ...options, enemyId: id, bonus: 1 })
}

const fightTarget = { kind: 'enemy', query: ({ state, inv, entity, helpers }) =>
  !helpers.entityRuleActive(entity, 'cannot:beAttacked') && attackableEnemies(state, inv).includes(entity) }
const evadeTarget = { kind: 'enemy', query: ({ state, inv, entity, enemyEvade }) =>
  enemyInEngagement(state, entity, inv) && Number.isFinite(enemyEvade(entity)) }
const entryTargets = (state, inv, source, isBlocked) => [
  ...(!isBlocked('fight') ? enumerateTargets(state, inv, fightTarget, { source }) : []).map(row => ({ ...row, action: 'fight' })),
  ...(!isBlocked('evade') ? enumerateTargets(state, inv, evadeTarget, { source }) : []).map(row => ({ ...row, action: 'evade' })),
]
const damageTargets = (state, inv, source, helpers) => enumerateTargets(state, inv, {
  kind: 'enemy', query: ({ entity }) => enemyInEngagement(state, entity, inv)
    && helpers.canDamageEnemy(entity, inv.seat, source.id),
}, { source })

export default {
  code: CODE,
  fast: true,
  abilities: [
    {
      kind: 'reaction', trigger: 'assetEnteredPlay', label: '入场：可对交战敌人造成 1 伤害，然后免费用攻击或躲避',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [ownSeat(), ({ state, inv, source, context, helpers }) => context.assetId === source.id
        && (entryTargets(state, inv, source, helpers.capabilityBlocked).length > 0 || damageTargets(state, inv, source, helpers).length > 0)],
      resolve: ctx => {
        const { state, inv, source, api } = ctx
        const damage = damageTargets(state, inv, source, { canDamageEnemy: (enemy, seat, id) => api.canDamageEnemy(enemy, seat, id) })
        if (damage.length) {
          const answer = api.choice({
            kind: 'target', source: CODE, seat: inv.seat, prompt: '可对一名与你交战的敌人造成 1 伤害。',
            options: [{ id: 'skip', label: '不造成伤害' }, ...damage.map(row => ({ id: row.id, label: row.label }))],
          })
          if (answer !== 'skip') api.damageEnemy(damage.find(row => row.id === answer).entity, 1, inv.seat, source.id)
        }
        const candidates = entryTargets(state, inv, source, kind => api.capabilityBlocked(inv.seat, kind))
        if (!candidates.length) return
        const answer = candidates.length === 1 ? '0' : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要攻击或躲避的敌人。',
          options: candidates.map((row, index) => ({
            id: String(index), label: `${row.action === 'fight' ? '攻击' : '躲避'} ${row.label}`,
          })),
        })
        const target = candidates[Number(answer)]
        return skilledAction(target.action, ctx, target.id)
      },
    },
    {
      kind: 'action', countsAs: 'fight', target: fightTarget, cost: { exhaust: true },
      criteria: [({ helpers }) => !helpers.capabilityBlocked('fight')],
      label: '横置：攻击，可使用意志，技能值 +1',
      resolve: (ctx) => skilledAction('fight', ctx, ctx.targetId),
    },
    {
      kind: 'action', countsAs: 'evade', target: evadeTarget, cost: { exhaust: true },
      criteria: [({ helpers }) => !helpers.capabilityBlocked('evade')],
      label: '横置：躲避，可使用意志，技能值 +1',
      resolve: (ctx) => skilledAction('evade', ctx, ctx.targetId),
    },
  ],
}
