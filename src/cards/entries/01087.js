// 01087 手电筒
// 卡面：使用(3补给)。
// 卡面：[action]花费1补给：调查。本次调查期间，你所在地点隐藏值-2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01087',
  uses: 3,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '照亮（调查，帷幕 -2）',
      cost: { action: true, uses: 1 },
      effect: { type: 'investigate', shroudMod: -2 },
    },
  ],
  modifiers: [

  ],
}
