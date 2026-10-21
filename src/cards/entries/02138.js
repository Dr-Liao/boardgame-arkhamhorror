// 02138 哈罗德·维尔斯特
// 卡面：你调查[[米斯卡塔尼克]]地点时得到+2[intellect]。
// 卡面：强制 - 在哈罗德·维尔斯特离场时：将他从游戏中移除，并在混乱袋里加入1个[tablet]标记，直到剧本结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02138 / 02139 / 02179（远古遗物系列）：调查员被消除时离场并进弃牌堆。

export default {
  code: '02138',
  discardOnElimination: true,
  abilities: [

  ],
  modifiers: [

  ],
}
