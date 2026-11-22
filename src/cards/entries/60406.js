export default {
  code: '60406',
  uses: 4,
  usesType: 'secret',
  abilities: [{
    kind: 'reaction',
    trigger: 'testInitiated',
    label: '此处发起检定后：花费 1 秘密，本次检定在投入卡牌前揭示混乱标记',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv, context }) => !context.revealBeforeCommit
      && state.investigators[context.seat]?.location === inv.location,
    resolve: ({ api, context }) => api.revealChaosBeforeCommit(context),
  }],
}
