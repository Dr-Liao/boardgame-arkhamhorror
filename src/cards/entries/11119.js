export default {
  code: '11119',
  uses: 1,
  usesType: 'shell',
  abilities: [
    {
      kind: 'action', label: '消耗 1 发炮弹：攻击，战力 +5、伤害 +3',
      cost: { action: true, uses: 1 }, countsAs: 'fight', target: { kind: 'enemy' },
      criteria: ({ source }) => Boolean(source && !source.exhausted),
      effect: { type: 'fight', combatBonus: 5, damageBonus: 3 },
    },
    {
      kind: 'action', label: '横置并补充炮弹',
      cost: { action: true, exhaust: true },
      criteria: ({ source }) => (source?.uses ?? 1) < 1,
      resolve: ({ source, api }) => api.addUses(source, 1),
    },
  ],
  modifiers: [],
}
