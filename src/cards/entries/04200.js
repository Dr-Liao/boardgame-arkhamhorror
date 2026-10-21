// 04200 学无止境
// 卡面：快速。在你技能检定失败且完毕后(结算该次技能检定的所有效果后)打出。
// 卡面：再次尝试该次检定。你本次检定得到+2技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04200 学无止境：快速；检定失败后重试（+2）。

export default {
  code: '04200',
  fast: true,
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'skillTestFailed', id: 'liveAndLearn', legacyReaction: true,
      criteria: { selfOnly: true }, label: '重新尝试上一次失败的技能检定（+2）',
      resolve: ({ api }) => api.retryLastFailedTest('学无止境', 2),
    },
  ],
  modifiers: [

  ],
}
