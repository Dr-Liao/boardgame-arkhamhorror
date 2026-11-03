// Spirit of Humanity — costs are paid before the chosen effect, through the common cost pipeline.
export default { code: '07229', abilities: [
  { kind: 'free', label: '横置并承受1伤害和1恐惧：加入2祝福',
    cost: { exhaust: true, damage: 1, horror: 1 },
    criteria: ({ helpers }) => helpers.poolTokenRoom('bless') > 0,
    resolve: ({ api }) => api.chaosTokens.add('bless', 2) },
  { kind: 'free', label: '横置并加入2诅咒：治疗1伤害和1恐惧', cost: { exhaust: true },
    additionalTokenCost: { token: 'curse', operation: 'add', count: 2 },
    criteria: ({ inv }) => (inv.damage || 0) > 0 || (inv.horror || 0) > 0,
    resolve: ({ inv, api }) => {
      api.healDamage(inv.seat, 1); api.healHorror(inv.seat, 1)
    } },
] }
