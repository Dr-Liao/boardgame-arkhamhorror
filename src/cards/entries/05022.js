// 05022 坚定不移
// 卡面：你剩余生命值和剩余神志值总和至少为5时，坚定不移获得[willpower][combat]
//       (你剩余生命值和剩余神志值总和至少为10时，改为坚定不移获得[willpower][willpower][combat][combat])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05022 坚定不移：印刷图标 1 意志 + 1 战斗；满足阈值时按 P7 条件图标原语叠加。
// 读点：src/engine/stats.js#commitIcons（conditions 按数组顺序取最后一个成立项）。

export default {
  code: '05022',
  abilities: [
    {
      kind: 'commit',
      label: '坚定不移',
      skill: {
        conditionalIcons: [
          { when: { remainingHealthSanityAtLeast: 5 }, icons: { willpower: 1, combat: 1 } },
          { when: { remainingHealthSanityAtLeast: 10 }, icons: { willpower: 2, combat: 2 } },
        ],
      },
    },
  ],
  modifiers: [

  ],
}
