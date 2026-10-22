// 04107 幸运烟盒
// 卡面：[reaction]你在一次技能检定中成功且超过难度2点或更多后，横置幸运烟盒：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04107 幸运箱：调查成功且超出 2 点时横置抽 1 张（每轮一次）。

export default {
  code: '04107',
  abilities: [
    {
      kind: 'reaction', trigger: 'skillTestSuccess', id: 'luckyCase', legacyReaction: true,
      criteria: { successByAtLeast: 2 }, limit: 'oncePerRound', label: '技能检定成功超出 2 点时抽 1 张',
      cost: { exhaust: true }, effect: { type: 'draw', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
