// 01100 忧郁症
// 卡面：显现 - 将忧郁症加入你的威胁区域。
// 卡面：强制 - 你受到伤害后：受到1点直接恐惧。
// 卡面：[action][action]：弃掉忧郁症。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01100',
  abilities: [
    {
      kind: 'weakness',
      label: '忧郁症',
      weakness: {
        type: 'threat',
        forced: { onDamage: { horror: 1 } },
        discardCost: { action: 2 },
      },
    },
  ],
  modifiers: [

  ],
}
