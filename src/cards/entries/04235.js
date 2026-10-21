// 04235 远古印记结晶
// 卡面：封印(+1或[elder_sign])。
// 卡面：你得到+1[willpower]、+1[intellect]、+1[combat]和+1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04235',
  sealOnEnter: "eldersign",
  passive: {"stats":{"willpower":1,"intellect":1,"combat":1,"agility":1}},
  abilities: [

  ],
  modifiers: [

  ],
}
