// 04025 寻宝猎人
// 卡面：你得到+1[intellect]。
// 卡面：强制 - 当补给阶段结束时：你必须支付1资源或弃掉寻宝猎人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04025',
  forcedUpkeepPayOrDiscard: 1,
  passive: {"stats":{"intellect":1}},
  abilities: [

  ],
  modifiers: [

  ],
}
