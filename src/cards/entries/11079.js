export default {
  code: '11079',
  abilities: [{
    kind: 'played', fast: true, trigger: 'mythosEncounterStep', requiresEncounterDeck: true,
    label: '你抽取本阶段所有常规遭遇牌，不能取消且首张涌动；跳过下次抽遭遇阶段步骤',
    limit: { scope: 'perGame', owner: 'group', count: 2 },
    criteria: [({ state, context }) => state.phase === 'mythos' && !context.skip],
    resolve: ({ inv, context, api }) => api.redirectMythosEncounterDraw(context, inv.seat, {
      uncancelable: true, firstSurge: true, skipNext: true,
    }),
  }],
}
