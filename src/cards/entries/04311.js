// 04311 第七印记的封印
// 卡面：封印([auto_fail])。使用(7充能)。如果第七印记的封印没有充能，或者其离场，将其从游戏中移除。
// 卡面：强制 - 在任何技能检定期间揭示[skull]、[cultist]、[tablet]或[elder_thing]标记后：从第七印记的封印上移除1充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04311 封印自动失败标记：7 充能、每个符号标记 +1、用尽移出游戏。

export default {
  code: '04311',
  sealOnEnter: 'autofail',
  uses: 7,
  usesType: 'charges',
  chargesOnSymbolReveal: 1,
  removeFromGameWhenEmpty: true,
  abilities: [

  ],
  modifiers: [

  ],
}
