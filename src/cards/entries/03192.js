// 03192 古代雕文
// 卡面：研究完成。(FAQ，v2.0)使用(3充能)。
// 卡面：[action]花费1充能：调查。你检定成功且每超过难度2点，发现你所在地点的额外1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03192',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      label: '引导石调查',
      cost: { action: true, uses: 1 },
      effect: { type: 'investigate', successByClueEvery: 2 },
    },
  ],
  modifiers: [

  ],
}
