// 10109 毛皮货：手牌上限 -3；在撤退或冒险结束时可获得一次购牌经验减免。
const CODE = '10109'

export default {
  code: CODE,
  modifiers: [{ target: 'handSize', amount: -3, condition: { sourceInHand: true } }],
  abilities: [{
    kind: 'reaction',
    trigger: ['investigatorResigning', 'scenarioEnding'],
    fromHand: true,
    noPlayCost: true,
    label: '冒险结束或你撤退时：下一张新购卡牌的经验值费用减少 1 点',
    limit: { scope: 'perGame', owner: 'player' },
    criteria: [({ state, inv, context }) => (context.seat == null || context.seat === inv.seat)
      && Boolean(state.campaign?.investigators?.[inv.seat])
      && !state.campaign.investigators[inv.seat].purchaseDiscount],
    resolve: ({ inv, api }) => {
      if (api.scenario.grantPurchaseDiscount(inv.seat, { amount: 1, uses: 1 })) {
        api.info('毛皮货：下一张新购卡牌的经验值费用减少 1 点。')
      }
    },
  }],
}
