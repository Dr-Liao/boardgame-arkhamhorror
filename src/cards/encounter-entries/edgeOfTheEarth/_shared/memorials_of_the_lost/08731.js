// 08731 爱伦·坡作品集 · 剧情资产。使用（3 充能）。
export default {
  code: '08731', scope: 'storyAsset', implemented: true,
  uses: 3, usesType: 'charges',
  flags: { memorial: true },
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '花费 1 充能：同地点调查员查找牌库顶 6 张，返还忒咳哩-哩，洗牌并抽 1 张',
    cost: { action: 1, uses: 1 },
    target: { kind: 'investigator' },
    resolve: ({ target, api }) => {
      const { seat } = target.entity
      api.returnTekeliFromDeck(seat, 6)
      api.drawCards(seat, 1)
    },
  }],
}
