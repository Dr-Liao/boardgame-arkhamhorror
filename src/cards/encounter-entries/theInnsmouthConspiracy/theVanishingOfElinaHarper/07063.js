// 马什精炼厂：每位玩家每场游戏可用一次，实际支付两个行动。
export default {
  code: '07063', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '马什精炼厂：抽取4张卡牌',
    cost: { action: 2 }, limit: { scope: 'perGame', owner: 'player' },
    criteria: [({ helpers }) => helpers?.canDrawCards?.() !== false],
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 4),
  }],
}
