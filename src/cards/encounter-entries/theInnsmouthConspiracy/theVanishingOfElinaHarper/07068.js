// 鱼街旧桥：每位玩家每场游戏一次，资源通过通常获得资源入口处理。
export default {
  code: '07068', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '鱼街旧桥：获得4资源',
    cost: { action: 2 }, limit: { scope: 'perGame', owner: 'player' },
    criteria: [({ helpers }) => helpers?.canGainResources?.() !== false],
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 4),
  }],
}
