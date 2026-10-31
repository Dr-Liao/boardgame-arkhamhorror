// 06243 增强自我（敏锐）
// 卡面：多重。每套牌库仅限 1 张增强自我（敏锐）。
//       最多 3 张增强自我卡牌共占 1 个法术槽位。
//       每当有卡牌效果要求你不使用[intellect]，改为使用[willpower]，你可以忽略这类效果。
//       [free] 横置增强自我：你本次检定得到 +2[intellect]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 已实现与简化口径同 06241：free 横置 +2 智识、restrictedSlots 近似共占 1 个法术槽；
// 「忽略用 willpower 代替 intellect 的效果」没有读点。

export default {
  code: '06243',
  simplified: true,
  note: '简化/未实现：(1)「最多 3 张增强自我共占 1 个法术槽位」用 restrictedSlots（arcane + [[仪式]]受限额外槽，count 1）近似——其它[[仪式]]支援也会吃到这份受限容量；(2)「每当有卡牌效果要求你用 willpower 代替 intellect 时可忽略」——引擎没有忽略属性替代的读点；(3) 每套牌库仅限 1 张（同名）由构筑层处理。已实现：[free] 横置：本次检定 +2 智识。',
  restrictedSlots: [{ slot: 'arcane', traitsAny: ['Ritual'], count: 1 }],
  abilities: [
    {
      kind: 'free',
      trigger: 'test.beforeCommit',
      label: '横置：本次检定 +2 智识',
      cost: { exhaust: true },
      duringOwnSkillTest: true,
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [],
}
