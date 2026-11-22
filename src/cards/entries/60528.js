export default {
  code: '60528',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'testWouldFail',
    label: '此处的调查员将要检定失败：该调查员本次检定 +3，并抽 1 张牌',
    criteria: ({ state, inv, context }) => state.investigators[context.seat]?.location === inv.location,
    resolve: ({ api, context }) => {
      api.setReactionFlag('testBonus', (context.testBonus || 0) + 3, context)
      api.drawCards(context.seat, 1)
    },
  }],
}
