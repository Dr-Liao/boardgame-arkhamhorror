// 04015 时间尽头
// 卡面：加尔文·怀特牌库专用。
// 卡面：直接伤害和直接恐惧可以被分配到时间尽头上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04015',
  passive: {"assignDirectHarm":true},
  abilities: [

  ],
  modifiers: [

  ],
}
