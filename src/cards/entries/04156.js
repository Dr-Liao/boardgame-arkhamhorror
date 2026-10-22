// 04156 挥金如土
// 卡面：[free]花费3资源并横置挥金如土：你本次技能检定得到+2技能值。如果你检定成功，获得3资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04156 挥金如土：支援的 [fast] 能力——花 3 资源并横置，本次检定 +2，成功后返还 3 资源。

export default {
  code: '04156',
  abilities: [
    {
      // 支援能力只能由 action/free 枚举；写成 played 会让整条能力不可达。
      kind: 'free', label: '花 3 资源并横置：本次检定 +2，成功后获得 3 资源',
      cost: { action: false, resources: 3, exhaust: true },
      duringOwnSkillTest: true,
      resolve: ({ api }) => {
        api.addTestPendingBonus(2)
        api.addExtraOnSuccess({ type: 'gainResource', amount: 3 })
      },
    },
  ],
  modifiers: [

  ],
}
