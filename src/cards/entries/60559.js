// 60559 折叠小刀 · 支援（手槽，2 费，敏捷图标，武器/近战）
// 卡面：[action]：攻击([combat]或[agility])。你本次检定得到技能值 +1。
//       如果本次攻击击败了敌人，你可以横置本卡以获得 1 资源。
const CODE = '60559'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      actionKind: 'fight',
      label: '攻击（战斗或敏捷）：技能值 +1',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        const skill = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat, prompt: '折叠小刀：选择本次攻击使用的技能。',
          options: [{ id: 'combat', label: '战斗' }, { id: 'agility', label: '敏捷' }],
        })
        api.fight(inv.seat, targetId, { combatBonus: 1, skill: skill === 'agility' ? 'agility' : 'combat' })
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyDefeated',
      label: '横置折叠小刀：本次攻击击败敌人后获得 1 资源',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => !context?.seat || context.seat === inv.seat],
      resolve: ({ inv, api }) => {
        api.gainResources(inv.seat, 1)
        api.info(`折叠小刀：${inv.name} 获得 1 资源。`)
      },
    },
  ],
  modifiers: [],
}
