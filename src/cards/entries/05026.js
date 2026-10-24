// 05026 好奇心
// 卡面：你至少有4张手牌时，好奇心获得[willpower][intellect]
//       (你至少有7张手牌时，改为好奇心获得[willpower][willpower][intellect][intellect])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05026 好奇心：印刷图标 1 意志 + 1 智识；满足手牌阈值时按 P7 条件图标原语叠加。

export default {
  code: '05026',
  abilities: [
    {
      kind: 'commit',
      label: '好奇心',
      skill: {
        conditionalIcons: [
          { when: { handAtLeast: 4 }, icons: { willpower: 1, intellect: 1 } },
          { when: { handAtLeast: 7 }, icons: { willpower: 2, intellect: 2 } },
        ],
      },
    },
  ],
  modifiers: [

  ],
}
