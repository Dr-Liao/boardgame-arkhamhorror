// 08059 掉进兔子洞（Down the Rabbit Hole）· 秘术师资产 · 永久（建库时购买，限 1 张）。
//
// 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
//       在一个剧本的每个冒险结束后，在下一场冒险之前，你升级的前 2 张卡牌经验值费用 -1。
//       你购买新卡牌所需要的经验值加 1。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点（战役层真实计价路径）：
//   · 这是建库/关间升级经验计价（src/campaign/campaign.js 的 replacementVerdict / purchaseCard），
//     条目只声明纯数据，不写行为：`flags.upgradeDiscount = { first, amount }`
//     （每个关间前 first 次升级各 -amount 经验）+ `flags.purchaseCostDelta`（新购卡 +N 经验）。
//   · 战役层按条目 flag 定位（不认卡号），在关间入口（refreshArcaneResearch 同一刷新点）
//     重置已用次数；升级与新购两条优惠互斥到同一张卡上。
//   · 「永久」由 cards-data 的 permanent:true 与引擎开局放置支援的循环负责，本条目无需 setup 钩子。

export default {
  code: '08059',
  flags: {
    upgradeDiscount: { first: 2, amount: 1 },
    purchaseCostDelta: 1,
  },
  abilities: [],
  modifiers: [],
}
