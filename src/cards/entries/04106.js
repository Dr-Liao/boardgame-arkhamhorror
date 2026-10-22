// 04106 老练分析
// 卡面：永久。
// 卡面：升级时，如果你升级一张带「(未鉴定)」或「(未翻译)」副标题的卡牌，你可以改为支付 0 经验，
// 把另一张同名副本升级为新的版本。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04106 老练分析：第 123 轮（第 8 批）为 src/campaign/campaign.js 的「老练分析」逻辑建条目——
// 它本身没有可执行能力，只声明身份标志 `shrewdAnalysis`，战役层按标志在牌组里找它。

export default {
  code: '04106',
  shrewdAnalysis: true,
  abilities: [

  ],
  modifiers: [

  ],
}
