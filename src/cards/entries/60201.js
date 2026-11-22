// 60201 哈维·沃尔特斯
// 卡面：[reaction]调查阶段期间，你所在地点的一位调查员从其牌库抽取1张或更多卡牌后：该调查员抽取1张卡牌。(每轮限一次。)
// 卡面：[elder_sign]效果：+1。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60201',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: { resolve: () => ({ delta: 1, draw: 1 }) },
  abilities: [{
    kind: 'reaction',
    trigger: 'cardsDrawn',
    label: '调查阶段同地点有人抽牌后：该调查员再抽 1 张',
    limit: { scope: 'perRound', owner: 'player' },
    criteria: ({ state, inv, context, helpers }) => state.phase === 'investigation'
      && context.location === inv.location && helpers.canDrawCards(context.seat),
    resolve: ({ context, api }) => api.drawCards(context.seat, 1),
  }],
}
