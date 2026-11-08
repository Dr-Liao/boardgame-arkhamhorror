// 08046 地下支持
// 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
//       你的牌库中每张非弱点、非署名卡牌最多只能有一张(以卡牌名称区别)。
//       你的牌库卡牌张数减 5。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：牌库 −5 由 deckConstruction.sizeBonus 表达（构筑层已读）。「每张非弱点/非署名卡
// 最多 1 张」是构筑层全局限制，现有 deckConstruction.options 只能按阵营/等级筛选，没有按卡名唯一的
// 字段（请求 m2-1-08046.json）；本卡先按「无该限制」参与构筑，条款待 P7 战役/构筑层接线。
export default {
  code: '08046',
  deckConstruction: {
    sizeBonus: -5,
  },
  abilities: [],
  modifiers: [],
}
