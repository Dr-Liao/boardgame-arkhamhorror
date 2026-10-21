// 05028 良好人脉
// 卡面：每位调查员仅限1张。
// 卡面：[free]横置良好人脉：你每有5资源，你本次技能检定得到技能值+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05028 良好人脉：每位调查员仅限 1 张；[免费]横置：每 5 资源 +1 技能值。

export default {
  code: '05028',
  abilities: [
    {
      kind: 'free', trigger: 'test.beforeCommit', label: '横置：每 5 资源使本次检定 +1',
      cost: { exhaust: true }, duringOwnSkillTest: true,
      resolve: ({ inv, api }) => api.addTestValue(Math.floor((inv.resources || 0) / 5)),
    },
  ],
  modifiers: [

  ],
}
