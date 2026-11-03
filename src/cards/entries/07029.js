import { SKILL_NAMES_ZH } from './_shared.js'

function cane({ state, inv, source, api }) {
  const candidates = state.enemies.filter(enemy => enemy.location === inv.location)
  const choices = candidates.flatMap(enemy => [
    ...['combat', 'willpower'].map(skill => ({ id: `fight:${enemy.id}:${skill}`, label: `攻击 ${enemy.name}（${SKILL_NAMES_ZH[skill]}）` })),
    ...(enemy.engagedSeat === inv.seat ? ['agility', 'willpower'].map(skill => ({ id: `evade:${enemy.id}:${skill}`, label: `躲避 ${enemy.name}（${SKILL_NAMES_ZH[skill]}）` })) : []),
  ])
  if (!choices.length) return
  const selected = api.choice({ kind: 'target', source: '07029', seat: inv.seat, prompt: '选择攻击或躲避，以及使用的技能。', options: choices })
  const option = choices.find(item => item.id === selected)
  if (!option) return
  const skill = selected.slice(selected.lastIndexOf(':') + 1)
  const action = selected.slice(0, selected.indexOf(':'))
  const enemyId = selected.slice(action.length + 1, selected.lastIndexOf(':'))
  if (action === 'fight') api.fight(inv.seat, enemyId, { assetId: source.id, skill, noSpend: true })
  else api.evade(inv.seat, { enemyId, assetId: source.id, skill })
}
export default { code: '07029', noOpportunityAttack: true, abilities: [
  { kind: 'reaction', trigger: 'assetEnteredPlay', label: '免费执行剑杖的攻击或躲避能力',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context, inv, state }) => context.assetId === source.id && context.seat === inv.seat
      && state.enemies.some(enemy => enemy.location === inv.location), resolve: cane },
  { kind: 'action', label: '横置：攻击或躲避（可改用意志）', countsAs: 'fight', cost: { action: true, exhaust: true },
    criteria: ({ state, inv }) => state.enemies.some(enemy => enemy.location === inv.location), resolve: cane },
] }
