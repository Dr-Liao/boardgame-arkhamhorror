export default {
  code: '11104',
  modifiers: [{
    target: 'testValue', amount: 1,
    condition: { when: ({ inv, state }) => state.skillTest?.seat === inv.seat
      && state.skillTest.actionKind === 'parley' },
  }],
  abilities: [{
    kind: 'reaction', trigger: 'parleySuccess',
    cost: { exhaust: true },
    label: '成功谈判后：横置沃尔特，获得 1 资源',
    criteria: ({ inv, context, helpers }) => context.seat === inv.seat && helpers.canGainResources(),
    resolve: ({ inv, api }) => { api.gainResources(inv.seat, 1) },
  }],
}
