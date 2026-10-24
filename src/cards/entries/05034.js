// 05034 预见未来
// 卡面：场上有至少3个毁灭标记时，预见未来获得[wild]
//       (场上有至少6个毁灭标记时，改为预见未来获得[wild][wild])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05034 预见未来：印刷图标 1 万能；满足毁灭阈值时按 P7 条件图标原语叠加。

export default {
  code: '05034',
  abilities: [
    {
      kind: 'commit',
      label: '预见未来',
      skill: {
        conditionalIcons: [
          { when: { doomAtLeast: 3 }, icons: { wild: 1 } },
          { when: { doomAtLeast: 6 }, icons: { wild: 2 } },
        ],
      },
    },
  ],
  modifiers: [

  ],
}
