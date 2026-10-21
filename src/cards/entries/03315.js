// 03315 伊苏之匙
// 卡面：伊苏之匙上每有一点恐惧，你得到每项技能+1。
// 卡面：强制 - 在任意数量的恐惧将要放置到你身上时：将其中1点恐惧放置到伊苏之匙上。
// 卡面：强制 - 在伊苏之匙离场时：弃掉你牌库顶10张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03315 伊苏之匙：离场时弃掉你牌库顶 10 张卡牌。
// （卡面的被动修正与伤害转移仍在旧 DSL 条目里，逐项迁移时再搬。）

export default {
  code: '03315',
  abilities: [
    {
      kind: 'leavesPlay', label: '离场：弃掉牌库顶 10 张卡牌',
      leavesPlay: { type: 'mill', amount: 10 },
    },
  ],
  redirectOneHorrorToSelf: true,
  passive: {"statsPerAssetHorror":1},
  modifiers: [

  ],
}
