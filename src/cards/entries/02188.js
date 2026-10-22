// 02188 孤狼
// 卡面：每位调查员仅限1张。
// 卡面：[reaction]在你回合开始时，如果你所在地点没有其他调查员：获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02188 孤狼：回合开始时若独自一人，获得 1 资源。

export default {
  code: '02188',
  limitPerInvestigator: true,
  abilities: [
    {
      kind: 'reaction', trigger: 'turnBegins', id: 'loneWolf', legacyReaction: true,
      criteria: { requiresAlone: true }, label: '独自一人时获得 1 资源',
      effect: { type: 'gainResource', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
