// 04236 自食其力
// 卡面：每位调查员仅限1张。
// 卡面：如果你控制的支援占用了盟友槽位，弃掉自食其力。
// 卡面：[reaction]在你打出一张[survivor]事件时，横置自食其力：该事件费用减2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04236 「自食其力」：控制占用盟友槽位的支援时自我弃掉（读点在 campaignDiscardOnYourOwn）。

export default {
  code: '04236',
  discardIfControllingAlly: true,
  survivorEventDiscount: true,
  limitPerInvestigator: true,
  abilities: [

  ],
  modifiers: [

  ],
}
