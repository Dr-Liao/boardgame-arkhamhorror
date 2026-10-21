// 01071 诡秘石像
// 卡面：使用(4充能)。如果诡秘石像没有充能，将其弃掉。
// 卡面：[reaction]在你将要揭示一个混乱标记时，花费1充能：改为揭示2个混乱标记，而非1个。选择其中1个标记结算，并忽略另一个。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01071',
  uses: 4,
  usesType: 'charges',
  discardWhenEmpty: true,
  chaosTokenExtraReveal: true,
  abilities: [

  ],
  modifiers: [

  ],
}
