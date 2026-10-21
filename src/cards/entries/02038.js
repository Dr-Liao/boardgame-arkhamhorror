// 02038 内伤
// 卡面：显现 - 将内伤放置入场，放到你的威胁区域。
// 卡面：强制 - 当你的回合结束时：受到1点直接伤害。
// 卡面：[action][action]：弃掉内伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02038',
  abilities: [
    {
      kind: 'weakness',
      label: '内伤',
      weakness: {
        type: 'threat',
        forced: { onTurnEnd: { damage: 1 } },
        discardCost: { action: 2 },
      },
    },
  ],
  modifiers: [

  ],
}
