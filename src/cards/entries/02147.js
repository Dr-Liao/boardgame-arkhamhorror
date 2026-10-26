// 02147 子弹袋
// 卡面：你拥有额外1个手部槽位，只可以用来携带[[武器]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 2026-10-26 原语层收敛：受限额外槽统一由 restrictedSlots 声明。旧实现用
// passive.extraSlots.handWeapon 这个「卡面专用槽名」写进引擎，canEquip 只在候选是武器时
// 加容量，漏了「已在场武器改占专用槽、把普通手槽让给非武器候选」的一面（子弹袋 + 武器 +
// 非武器会误判满槽）。现在容量/占用由 restrictedSlotInfo 统一判定，候选卡与在场卡同一口径；
// 回归用例见 tests/slot-rules.test.mjs。
export default {
  code: '02147',
  restrictedSlots: [
    { slot: 'hand', traitsAny: ['Weapon'], count: 1 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
