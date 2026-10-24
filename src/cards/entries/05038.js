// 05038 体格强健
// 卡面：你控制的[[道具]]支援不超过2张时，体格强健获得[combat][agility]
//       (你控制的[[道具]]支援不超过1张时，改为体格强健获得[combat][combat][agility][agility])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05038 体格强健：印刷图标 1 战斗 + 1 敏捷；按控制的[[道具]]数量按 P7 条件图标原语叠加。

export default {
  code: '05038',
  abilities: [
    {
      kind: 'commit',
      label: '体格强健',
      skill: {
        conditionalIcons: [
          { when: { controlledTraitAtMost: { trait: 'item', count: 2 } }, icons: { combat: 1, agility: 1 } },
          { when: { controlledTraitAtMost: { trait: 'item', count: 1 } }, icons: { combat: 2, agility: 2 } },
        ],
      },
    },
  ],
  modifiers: [

  ],
}
