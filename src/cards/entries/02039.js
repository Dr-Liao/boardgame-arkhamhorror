// 02039 时间恐惧症
// 卡面：显现 - 将时间恐惧症放置入场，放到你的威胁区域。
// 卡面：强制 - 当你的回合结束时：受到1点直接恐惧。
// 卡面：[action][action]：弃掉时间恐惧症。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02039',
  abilities: [
    {
      kind: 'weakness',
      label: '时间恐惧症',
      weakness: {
        type: 'threat',
        forced: { onTurnEnd: { horror: 1 } },
        discardCost: { action: 2 },
      },
    },
  ],
  modifiers: [

  ],
}
