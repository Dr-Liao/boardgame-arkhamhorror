// 06117 解读秘符
// 卡面：调查。本次调查将你的[willpower]值加入你的技能值。
//       你可以忽略本次调查期间你所在地点将要触发的任何效果和关键词。
//       如果你检定成功，发现本地点额外1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：调查走 api.investigate（opts.addSkill 把意志值加入技能值、opts.clueBonus 追加成功线索）。
// 显式简化（simplified）：「可以忽略本次调查期间地点将触发的任何效果和关键词」没有通用读取点
// （引擎逐地点效果硬编码在各自行为里），未实现；其余三条已实现。

export default {
  code: '06117',
  simplified: true,
  note: '未实现：「你可以忽略本次调查期间你所在地点将要触发的任何效果和关键词」——'
    + '引擎没有「忽略地点效果/关键词」的通用读取点；调查、把意志值加入技能值、成功额外发现 1 个线索均已实现。',
  abilities: [
    {
      kind: 'played',
      label: '解读秘符：调查（加入意志值；成功额外发现 1 个线索）',
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { addSkill: 'willpower', clueBonus: 1 })
      },
    },
  ],
  modifiers: [],
}
