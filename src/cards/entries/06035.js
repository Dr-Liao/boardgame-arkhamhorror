// 06035 自私自利（基础弱点）
// 卡面：多人游戏专用。
//       显现 - 将自私自利放置入场，放到你的威胁区域。
//       你不能对其他调查员的技能检定投入卡牌，也不能用玩家卡牌的效果影响其他调查员(造成伤害或恐惧的效果除外)。
//       [action] [action]：弃掉自私自利。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06035 自私自利（显式简化）：
//   · 威胁区弱点 + 弃置费用 [action][action]：weakness 数据体 { type:'threat', discardCost:{ action:2 } }
//     （读点 moves.js 的 discardThreat / actions-extra 的 doDiscardThreat）。
//   · 显式简化：两条跨调查员限制没有读点——
//     「不能对其他调查员的技能检定投入卡牌」：投入循环的 capability:commit 只挡自己的检定，
//     没有「本次检定不是我的」这个读点；
//     「不能用玩家卡牌的效果影响其他调查员」：引擎没有「玩家卡效果不能指向他人」的通用闸门。

export default {
  code: '06035',
  simplified: true,
  note: '未实现：不能对其他调查员的技能检定投入卡牌、不能用玩家卡效果影响其他调查员'
    + '（引擎无对应读点：capability:commit 只挡自己的检定，也没有玩家卡效果指向他人的通用限制）；已实现威胁区与 [action][action] 弃置。',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域；[action][action] 弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
  ],
  modifiers: [],
}
