// 06035 自私自利（基础弱点）
// 卡面：多人游戏专用。
//       显现 - 将自私自利放置入场，放到你的威胁区域。
//       你不能对其他调查员的技能检定投入卡牌，也不能用玩家卡牌的效果影响其他调查员(造成伤害或恐惧的效果除外)。
//       [action] [action]：弃掉自私自利。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06035 自私自利：
//   · 威胁区弱点 + 弃置费用 [action][action]：weakness 数据体 { type:'threat', discardCost:{ action:2 } }
//     （读点 moves.js 的 discardThreat / actions-extra 的 doDiscardThreat）。
//   · 不能协助其他调查员检定或用玩家卡效果影响他人，由通用目标/效果闸门执行；
//     伤害与恐惧效果依卡面例外照常结算。

export default {
  code: '06035',
  cannotAffectOtherInvestigators: true,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域；[action][action] 弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
  ],
  modifiers: [],
}
