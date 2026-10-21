// 02110 适应性
// 卡面：永久。
// 卡面：在一个剧本的每场游戏间，你可以将你牌库中最多两张等级0的卡牌换为同等数量的等级0卡牌。(你仍然必须遵守你调查员的牌库构建规则)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02110 适应性：永久；每个关间可免费替换 2 张 0 级卡（读点在 campaign.js 的 upgrade 报价）。

export default {
  code: '02110',
  passive: { permanent: true },
  adaptableSwaps: 2,
  abilities: [

  ],
  modifiers: [

  ],
}
