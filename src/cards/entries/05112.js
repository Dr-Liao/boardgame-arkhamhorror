// 05112 魔法手势
// 卡面：快速。
// 卡面：你拥有额外1个法术槽位，只能用来携带一张[[法术]]或[[仪式]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05112 魔法手势：额外 1 个法术槽位（简化为不限制只能带[[法术]]/[[仪式]]）。

export default {
  code: '05112',
  simplified: true,
  note: '额外槽位未限制卡牌特性；完整实现需要带特性的槽位规则。',
  modifiers: [
    { target: 'slot:arcane', amount: 1 },
  ],
  abilities: [

  ],
}
