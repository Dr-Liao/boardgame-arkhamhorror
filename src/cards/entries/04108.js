// 04108 销赃贩子
// 卡面：[reaction]你在你的回合期间打出[[违法]]卡牌时，横置销赃贩子：该[[违法]]卡牌获得快速。如果该卡牌已有快速，改为降低其费用1点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04108 销赃贩子：非法物快速 / 减费。

export default {
  code: '04108',
  fastForIllicit: true,
  abilities: [

  ],
  modifiers: [

  ],
}
