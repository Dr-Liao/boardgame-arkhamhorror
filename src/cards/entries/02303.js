// 02303 揭开现实的面纱
// 卡面：调查。本次技能检定的难度等于场上已揭示地点中最高的隐藏值。如果你检定成功，发现场上每个已揭示地点各1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02303',
  abilities: [
    { kind: 'played', label: '揭开现实的面纱', effect: { type: 'decipheredReality' } },
  ],
  modifiers: [

  ],
}
