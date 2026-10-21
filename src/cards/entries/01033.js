// 01033 米兰·克里斯托弗博士
// 卡面：你得到+1[intellect]。
// 卡面：[reaction]在你成功调查后：获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01033 米兰·克里斯托弗博士：调查成功后获得 1 资源（被动 +1 智识）。

export default {
  code: '01033',
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'investigateSuccess', id: 'milan', legacyReaction: true,
      label: '调查成功后获得 1 资源', effect: { type: 'gainResource', amount: 1 },
    },
  ],
}
