// 05276 苦心钻研
// 卡面：永久。
// 卡面：每场游戏开始时，你的起始手牌中额外有一张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05276 苦心钻研：纯数据卡。永久卡在开局统计阶段入场，setup.js#drawOpeningHand 读
// registeredEntry(code).openingHandBonus 把起始手牌数 +N（与 investigator.openingHandSize 同一处结算）。

export default {
  code: '05276',
  openingHandBonus: 1,
  abilities: [

  ],
  modifiers: [

  ],
}
