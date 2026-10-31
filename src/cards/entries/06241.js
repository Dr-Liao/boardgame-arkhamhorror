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
//   · 「最多 3 张同名卡共占 1 个法术槽位」用受限额外槽（restrictedSlots，arcane/Ritual）近似。
// 未实现/简化（见 note）：「忽略 willpower 代替 combat 的效果」没有读点；同名限 1 由构筑层处理。

export default {
  code: '06241',
  simplified: true,
  note: '简化/未实现：(1)「最多 3 张增强自我共占 1 个法术槽位」用 restrictedSlots（arcane + [[仪式]]受限额外槽，count 1）近似——3 张同名可同时在场且基本只占 1 个法术槽，但其它[[仪式]]支援也会吃到这份受限容量；(2)「每当有卡牌效果要求你用 willpower 代替 combat 时可忽略」——引擎没有忽略属性替代的读点；(3) 每套牌库仅限 1 张（同名）由构筑层处理。已实现：[free] 横置：本次检定 +2 战斗。',
  restrictedSlots: [{ slot: 'arcane', traitsAny: ['Ritual'], count: 1 }],
  abilities: [
    {
      kind: 'free',
      trigger: 'test.beforeCommit',
      label: '横置：本次检定 +2 战斗',
      cost: { exhaust: true },
      duringOwnSkillTest: true,
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [],
}
