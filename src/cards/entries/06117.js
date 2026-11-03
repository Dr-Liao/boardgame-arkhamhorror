// 06117 解读秘符
// 卡面：调查。本次调查将你的[willpower]值加入你的技能值。
//       你可以忽略本次调查期间你所在地点将要触发的任何效果和关键词。
//       如果你检定成功，发现本地点额外1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 调查走 api.investigate；这次调查的地点效果/关键词可逐项忽略。

export default {
  code: '06117',
  abilities: [
    {
      kind: 'played',
      countsAs: 'investigate',
      label: '解读秘符：调查（加入意志值；成功额外发现 1 个线索）',
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { addSkill: 'willpower', clueBonus: 1, mayIgnoreLocationEffects: true })
      },
    },
  ],
  modifiers: [],
}
