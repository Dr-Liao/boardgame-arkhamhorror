// 04106 老练分析
// 卡面：永久。每套牌库仅限 1 张。
// 卡面：每当你升级带有(未鉴定)或(未翻译)副标题的卡牌时，你可以多升级 1 张同名卡牌，无需花费经验值。
//       如果你这么做，从符合条件的选项中随机选择该卡牌的两张升级版本。(你仍需满足所有的牌库构建限制。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04106 老练分析：本条目只声明身份标志 `shrewdAnalysis`（读点 src/engine/ability.js:717），
// 具体升级逻辑在 src/campaign/campaign.js 的 shrewdAnalysisEligible / shrewdAnalysisUpgrade（:31-65）。
// 注意：该函数目前在真实升级流程（src/engine/hub.js:130-140 → campaign.js:262-284 purchaseCard /
// stagePurchase）里没有被调用（全仓 grep 'shrewdAnalysisUpgrade' 只有定义与测试直调），因此卡面效果
// 还不会在游玩中生效。需要战役层接线，请求见 artifacts/tfa-fix/primitive-requests/player-1-04106.json。

export default {
  code: '04106',
  shrewdAnalysis: true,
  abilities: [

  ],
  modifiers: [

  ],
}
