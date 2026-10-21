// 04008 杰克·威廉斯
// 卡面：厄休拉·唐斯牌库专用。
// 卡面：你每回合执行的第一个移动或调查行动不会触发趁乱攻击。
// 卡面：[reaction]在你揭示一个地点或放置一个新的地点入场后，横置杰克·威廉斯：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04008',
  passive: {"noOpportunityFirstAction":true},
  abilities: [
    {
      kind: 'reaction', trigger: 'locationRevealed', id: 'jakeDraw', legacyReaction: true,
      label: '是否横置杰克·威廉斯抽取 1 张牌？', cost: { exhaust: true }, limit: 'oncePerRound',
      effect: { type: 'draw', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
