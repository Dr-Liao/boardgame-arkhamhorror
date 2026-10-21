// 04013 古代抄本
// 卡面：马泰奥神父牌库专用。封印([elder_sign])。
// 卡面：有标记被封印在此时，你得到+1[willpower]。
// 卡面：[reaction]在你将要从混乱袋中揭示一个混乱标记时，弃掉古代抄本：结算封印在此的[elder_sign]标记，如同刚刚从混乱袋中揭示该标记(而不是从混乱袋中揭示一个标记)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04013',
  sealOnEnter: "eldersign",
  substituteSealedElderSign: true,
  passive: {"statsWhileSealed":{"willpower":1}},
  abilities: [

  ],
  modifiers: [

  ],
}
