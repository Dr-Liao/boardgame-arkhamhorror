// 03269 圣胡伯的钥匙
// 卡面：你得到+1[willpower]，+1[intellect]和-2神智值。
// 卡面：[reaction]在你将要由于恐惧被击败时，弃掉圣胡伯的钥匙：立刻治愈2点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03269 圣休伯特：意志/智识 +1、理智 -2；将要因恐惧被击败时弃掉自身治愈 2 点恐惧。

export default {
  code: '03269',
  passive: { stats: { willpower: 1, intellect: 1 }, sanityBonus: -2 },
  abilities: [
    {
      kind: 'reaction', trigger: 'wouldDefeatByHorror', id: 'stHubert', legacyReaction: true,
      label: '弃置自身治愈 2 点恐惧', cost: { discardSelf: true },
      effect: { type: 'heal', amount: 2, what: 'horror' },
    },
  ],
  modifiers: [

  ],
}
