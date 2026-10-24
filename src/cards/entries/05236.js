// 05236 指路鬼魂（幸存者 · 1 经验）
// 卡面：你得到+1[intellect]。
// 卡面：非直接恐惧在分配到你的调查员卡牌之前，必须先分配给指路鬼魂。
// 卡面：强制 - 在指路鬼魂因为恐惧而被击败时：将其放逐。
// 卡面数据：3 神智（盟友）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05236 指路鬼魂：+1 智慧；「沉静」（非直接恐惧必须先分给它）；因恐惧离场时移出游戏。
//
// 显式简化（详见 worker 报告）：
//   未实现：「因为恐惧而被击败时放逐」的精确原因判定与战役放逐记账（state.exiled）。
//   现有可用的窄口径是条目级 removeFromGameOnLeave —— 只要这张支援离场就进 removedFromGame，
//   读不到「离场原因是不是恐惧」。行为影响：仅放逐记账/战役结算，场景内效果等价。
//   proposedApi: assetDefeatedBy(asset, 'horror') 读点或 leavesPlay 原因上下文；P10 前补。

export default {
  code: '05236',
  simplified: true,
  note: '未实现：「因恐惧被击败时放逐」的离场原因判定与战役放逐记账（state.exiled）——用条目级 '
    + 'removeFromGameOnLeave 近似为「离场即移出游戏」；+1 智慧与「沉静」（非直接恐惧必须先分给本支援）已实现。P10 前补。',
  composure: true,
  removeFromGameOnLeave: true,
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [],
}
