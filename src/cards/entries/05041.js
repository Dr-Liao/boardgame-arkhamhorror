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
//   2. 光环：条目字段 failTies=true。引擎在技能检定成功判定处（src/engine/tests.js:846-851）
//      扫描「同地点任意调查员威胁区里的 failTies 条目」，平局按失败结算且 failedBy=0（不再用
//      wouldSucceedTest 的 testBonus-1 近似）。
//   3. [action][action]：威胁区弃置行动由 discardCost.action = 2 声明（读点 moves.js / doDiscardThreat）。

export default {
  code: '05041',
  // 审计 R4：光环读点（engine tests.js:846-851 读同地点威胁区条目的 failTies 字段）。
  failTies: true,
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
  ],
  modifiers: [

  ],
}
