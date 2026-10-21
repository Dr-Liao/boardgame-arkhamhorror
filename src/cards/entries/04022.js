// 04022 古代巨石
// 卡面：[action]：调查。本次调查你所在地点的隐藏值+3。如果你检定成功，发现你所在地点额外1个线索，弃掉古代巨石，并在剧本日志中记录“你鉴定了古代巨石”。在记下的文字旁边以括号形式记录下本次技能检定难度。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04022 古代石头：调查时所在地点帷幕 +3。

export default {
  code: '04022',
  abilities: [
    {
      kind: 'action', label: '调查（本地帷幕 +3）', cost: { action: true },
      resolve: ({ inv, api }) => api.investigate(inv.seat, { shroudMod: 3, ancientStone: true }),
    },
  ],
  identifiedStoneOnInvestigateSuccess: true,
  modifiers: [

  ],
}
