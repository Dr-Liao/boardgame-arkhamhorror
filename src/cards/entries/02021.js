// 02021 奇怪的溶液
// 卡面：[action]：检定[intellect](4)。如果你检定成功，弃掉奇怪的溶液并抽取2张卡牌。在剧本日志里记录“你确认了溶液的成分。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02021',
  abilities: [
    {
      kind: 'action',
      label: '研究溶液（智识 4；成功则弃置并抽 2 张牌）',
      cost: { action: true },
      effect: { type: 'researchSolution' },
    },
  ],
  modifiers: [

  ],
}
