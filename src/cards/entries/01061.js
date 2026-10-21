// 01061 探知术
// 卡面：使用(3充能)。
// 卡面：[action]横置探知术并花费1充能：查看任意一位调查员的牌库顶或遭遇牌库顶3张卡牌。将其以任意顺序放回该牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01061',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '窥视（查看任意牌库顶 3 张并重排）',
      cost: { action: true, exhaust: true, uses: 1 },
      effect: { type: 'scry' },
    },
  ],
  modifiers: [

  ],
}
