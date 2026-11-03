// 06241 增强自我（毅力）
// 卡面：多重。每套牌库仅限 1 张增强自我（毅力）。
//       最多 3 张增强自我卡牌共占 1 个法术槽位。
//       每当有卡牌效果要求你不使用[combat]，改为使用[willpower]，你可以忽略这类效果。
//       [free] 横置增强自我：你本次检定得到 +2[combat]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 已实现：
//   · [free] 横置：本次检定 +2 战斗（test.beforeCommit 玩家窗口 + api.addPendingTestBonus，
//     与检定主流程合并在同一次检定里）；
//   · 三张增强自我共占一槽由 sharedSlotGroup 精确计算。
//   · 属性替代时可选忽略由 ignoreSkillSubstitution 接入原动作检定。

export default {
  code: '06241',
  ignoreSkillSubstitution: { from: 'combat', to: 'willpower' },
  sharedSlotGroup: { id: 'empowerSelf', slot: 'arcane', upTo: 3 },
  abilities: [
    {
      kind: 'free',
      trigger: 'test.beforeCommit',
      label: '横置：本次检定 +2 战斗',
      cost: { exhaust: true },
      duringOwnSkillTest: true,
      criteria: [({ state }) => [state.skillTest?.skill].flat().includes('combat')],
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [],
}
