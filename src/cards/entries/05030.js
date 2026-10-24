// 05030 狡猾
// 卡面：你拥有至少5资源时，狡猾获得[intellect][agility]
//       (你拥有至少10资源时，改为狡猾获得[intellect][intellect][agility][agility])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05030 狡猾：印刷图标 1 智识 + 1 敏捷；满足资源阈值时按 P7 条件图标原语叠加。

export default {
  code: '05030',
  abilities: [
    {
      kind: 'commit',
      label: '狡猾',
      skill: {
        conditionalIcons: [
          { when: { resourcesAtLeast: 5 }, icons: { intellect: 1, agility: 1 } },
          { when: { resourcesAtLeast: 10 }, icons: { intellect: 2, agility: 2 } },
        ],
      },
    },
  ],
  modifiers: [

  ],
}
