// 08737 高田的物品 · 剧情事件。快速：获得 3 资源并抽 1 张牌，然后移出游戏。
export default {
  code: '08737',
  scope: 'card',
  scenarioPlayable: true,
  removeAfterPlay: true,
  abilities: [{
    kind: 'played',
    label: '获得 3 资源并抽 1 张牌',
    fast: true,
    resolve: ({ inv, api }) => {
      api.gainResources(inv.seat, 3)
      api.drawCards(inv.seat, 1)
    },
  }],
}
