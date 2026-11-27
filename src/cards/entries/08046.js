// 08046 地下支持
// 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
//       你的牌库中每张非弱点、非署名卡牌最多只能有一张(以卡牌名称区别)。
//       你的牌库卡牌张数减 5。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 构筑时按卡名限制非弱点、非署名卡，并减少 5 张牌。
export default {
  code: '08046',
  campaignDeck: { startingOnly: true },
  deckConstruction: {
    sizeBonus: -5,
    singletonByName: true,
  },
  abilities: [],
  modifiers: [],
}
