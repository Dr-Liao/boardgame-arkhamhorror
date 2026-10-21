// 01031 智慧古书
// 卡面：[action]横置智慧古书：选择你所在地点的一位调查员。该调查员查找其牌库顶3张卡牌，找出一张将其抽取，并将剩余卡牌混洗入自己牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01031',
  abilities: [
    {
      kind: 'action',
      label: '研读（同地点调查员检索牌库顶 3 张，选择 1 张）',
      cost: { action: true, exhaust: true },
      effect: {
        type: 'targetedEffect',
        target: 'location',
        effect: { type: 'searchTop', amount: 3, choose: 1 },
      },
    },
  ],
  modifiers: [

  ],
}
