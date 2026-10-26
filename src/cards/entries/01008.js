// 01008 黛西的手提包
// 卡面：黛西·沃克牌库专用。
// 卡面：你拥有额外2个手部槽位，只可以用来携带[[书籍]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 2026-10-26 原语层收敛：受限额外槽统一由 restrictedSlots 声明（槽位 + 命中特性 + 数量），
// 容量与占用由 src/engine/assets.js 的 restrictedSlotInfo/canEquip 统一判定；候选卡（正在
// 打出的书）也走同一条「容量只给特性命中的卡、受限占用不占普通槽」的路径。旧的两套写法
// （passive.handSlotsBonus + tomeHandSlotsPerCopy，以及只写不读的 handSlotsTrait）已删除。
export default {
  code: '01008',
  restrictedSlots: [
    { slot: 'hand', traitsAny: ['Tome'], count: 2 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
