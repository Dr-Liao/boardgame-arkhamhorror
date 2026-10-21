// 04007 血的代价
// 卡面：显现 - 你必须从场上弃掉你控制的一张[[盟友]]支援卡牌，或弃掉手牌中的所有[[盟友]]支援。如果没有因本效果弃掉的支援，将血的代价洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04007',
  abilities: [
    { kind: 'weakness', label: '血的代价', weakness: { type: 'boughtInBlood' } },
  ],
  modifiers: [

  ],
}
