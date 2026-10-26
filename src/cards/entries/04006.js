// 04006 米奇·布朗
// 卡面：里奥·安德森牌库专用。
// 卡面：你拥有额外2个盟友槽位，只可以用来携带非独特盟友。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 2026-10-26 原语收敛：盟友受限槽并入 restrictedSlots（unique:false 表示只放非独特盟友），
// 容量/占用由 src/engine/assets.js 的 restrictedSlotInfo 统一判定；旧的
// passive.allySlotsForNonUnique 与 allySlotsOk/allySlotCapacities 旁路已删除。
export default {
  code: '04006',
  restrictedSlots: [
    { slot: 'ally', unique: false, count: 2 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
