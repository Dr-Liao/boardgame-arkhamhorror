export default {
  code: '07008', abilities: [{ kind: 'reaction', trigger: 'testInitiated', fromHand: true, label: '收回下方牌，改放晦涩研究',
    criteria: ({ inv, context }) => inv.seat === context.seat,
    resolve: ({ inv, api }) => api.investigatorTools.swapBeneathEvent(inv.seat, '07002', '07008') }],
}
