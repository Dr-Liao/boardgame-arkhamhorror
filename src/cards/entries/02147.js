// 02147 子弹袋
// 卡面：你拥有额外1个手部槽位，只可以用来携带[[武器]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02147',
  passive: {"extraSlots":{"handWeapon":1}},
  abilities: [

  ],
  modifiers: [

  ],
}
