// 60205 秘术启迪
// 卡面：你的手牌上限增加1张。
// 卡面：你拥有额外1个手部槽位，只能用来放置一张[[书籍]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60205',
  passive: { handSizeBonus: 1 },
  restrictedSlots: [{ slot: 'hand', traitsAny: ['Tome'], count: 1 }],
}
