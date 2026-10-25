// 05112 魔法手势
// 卡面：快速。
// 卡面：你拥有额外1个法术槽位，只能用来携带一张[[法术]]或[[仪式]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：受限额外槽由条目字段 restrictedSlots 声明（引擎 assets.canEquip 读点：只有特性命中的卡
// 才能使用该额外容量，受限占用不计入普通槽位）。`fast` 是资产关键字，写在条目上。

export default {
  code: '05112',
  fast: true,
  restrictedSlots: [
    { slot: 'arcane', traitsAny: ['Spell', 'Ritual'], count: 1 },
  ],
  abilities: [],
}
