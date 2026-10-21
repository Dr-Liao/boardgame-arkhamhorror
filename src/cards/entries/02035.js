// 02035 彼得·希尔维斯特
// 卡面：你得到+1[agility]和+1[willpower]。
// 卡面：[reaction]在你的回合结束后：治愈彼得·希尔维斯特的1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02035',
  healSelfHorrorAfterTurn: 1,
  passive: {"stats":{"agility":1,"willpower":1}},
  abilities: [

  ],
  modifiers: [

  ],
}
