// 05041 第十三幻象（基础弱点）
// 卡面：显现 - 将第十三幻象放置入场，放到你的威胁区域。
// 卡面：你所在地点的调查员在技能检定期间，技能值等于检定难度时检定失败。
// 卡面：[action][action]：弃掉第十三幻象。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05041 第十三幻象：
//   1. 显现：威胁区弱点的通用数据通道（weakness.type = 'threat'，resolveWeakness 把卡放进威胁区域）；
//   2. 光环：强制 - 「技能值等于难度」的检定改为失败。读点用引擎的 wouldSucceedTest 窗口：
//      把窗口上下文的 testBonus 减 1，原本平局的检定因此落到难度之下。
//      作用范围读 context.seat 的所在地点 = 本卡持有者的地点（「你所在地点的调查员」）。
//   3. [action][action]：威胁区弃置行动由 discardCost.action = 2 声明（读点 moves.js / doDiscardThreat）。

export default {
  code: '05041',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      kind: 'forced',
      trigger: 'wouldSucceedTest',
      label: '技能值等于检定难度时改为失败',
      criteria: [({ state, inv, context }) => context?.testValue != null
        && context.testValue === context.difficulty
        && state.investigators[context.seat]?.location === inv.location],
      resolve: ({ context }) => {
        context.testBonus = (context.testBonus || 0) - 1
      },
    },
  ],
  modifiers: [

  ],
}
