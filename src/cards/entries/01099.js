// 01099 神经紊乱
// 卡面：显现 - 将神经紊乱加入你的威胁区域。
// 卡面：强制 - 你受到恐惧后：受到1点直接伤害。
// 卡面：[action][action]：弃掉神经紊乱。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01099',
  abilities: [
    {
      kind: 'weakness',
      label: '神经紊乱',
      weakness: {
        type: 'threat',
        forced: { onHorror: { damage: 1 } },
        discardCost: { action: 2 },
      },
    },
  ],
  modifiers: [

  ],
}
