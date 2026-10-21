// 04156 挥金如土
// 卡面：[free]花费3资源并横置挥金如土：你本次技能检定得到+2技能值。如果你检定成功，获得3资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04156 挥金如土：本次检定 +2；成功后返还 3 资源。

export default {
  code: '04156',
  abilities: [
    {
      kind: 'played', id: 'extravagance', label: '本次检定 +2，成功后返还 3 资源',
      resolve: ({ api }) => {
        api.addTestPendingBonus(2)
        api.addExtraOnSuccess({ type: 'gainResource', amount: 3 })
      },
    },
  ],
  modifiers: [

  ],
}
