// 01008 黛西的手提包
// 卡面：黛西·沃克牌库专用。
// 卡面：你拥有额外2个手部槽位，只可以用来携带[[书籍]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01008',
  passive: {"handSlotsBonus":2,"handSlotsTrait":"Tome"},
  tomeHandSlotsPerCopy: 2,
  abilities: [

  ],
  modifiers: [

  ],
}
