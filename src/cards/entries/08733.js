// 08733 戴尔的素描 · 剧情事件。快速：抽取 3 张牌。
export default {
  code: '08733',
  scope: 'card',
  scenarioPlayable: true,
  abilities: [{
    kind: 'played',
    label: '抽取 3 张牌',
    fast: true,
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 3),
  }],
}
