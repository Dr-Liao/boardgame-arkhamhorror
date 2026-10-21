// 03143 褴褛披风
// 卡面：你得到-1神智值。
// 卡面：你的剩余神智值不多于3时，你得到+1[willpower]，+1[combat]，+1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03143 褴褛披风：+1 意志/战斗/敏捷（剩余理智 ≤ 3 时），-1 理智上限。
// 读点在 modifiers.js 的 conditionalStats 折叠——条目级 passive 与旧 DSL 走同一份读点。

export default {
  code: '03143',
  passive: { sanityBonus: -1, conditionalStats: { remainingSanityAtMost: 3,
  stats: { willpower: 1, combat: 1, agility: 1 } } },
  abilities: [

  ],
  modifiers: [

  ],
}
