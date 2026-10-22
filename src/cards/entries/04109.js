// 04109 奥术研究
// 卡面：永久。
// 卡面：你购买本卡牌时，承受 1 点精神创伤。
// 卡面：每场冒险后，你购买的第一张法术卡牌减少 1 点经验。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04109 奥术研究：第 123 轮（第 8 批）为 src/campaign/campaign.js 的「奥术研究」逻辑建条目——
// 购买时创伤在 campaign.js，条目只声明身份标志 `arcaneResearch`（战役层按标志找它）。

export default {
  code: '04109',
  arcaneResearch: true,
  abilities: [

  ],
  modifiers: [

  ],
}
