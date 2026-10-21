// 04031 保护咒语
// 卡面：团队仅限2张保护咒语在场。
// 卡面：封印(除了[auto_fail]以外的任何标记)。
// 卡面：强制 - 当你的回合结束时：你必须花费1资源或弃掉保护咒语。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04031 封印任意非自动失败标记：回合结束付费或弃置，团队上限 2。

export default {
  code: '04031',
  sealOnEnterChoice: 'nonAutofail',
  forcedTurnEndPayOrDiscard: 1,
  teamLimit: 2,
  abilities: [

  ],
  modifiers: [

  ],
}
