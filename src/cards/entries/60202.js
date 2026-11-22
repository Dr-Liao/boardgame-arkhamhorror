// 60202 知识宝库
// 卡面：哈维·沃尔特斯牌库专用。
// 卡面：你的手牌上限增加2张。
// 卡面：[reaction]你调查成功后，横置知识宝库并选择你所在地点的一位调查员：该调查员抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60202',
  passive: { handSizeBonus: 2 },
  abilities: [{
    kind: 'reaction',
    trigger: 'investigateSuccess',
    label: '调查成功后横置：同地点一位调查员抽 1 张牌',
    cost: { exhaust: true },
    criteria: ({ state, inv, context, helpers }) => context.seat === inv.seat
      && state.investigators.some(player => player.location === inv.location && helpers.canDrawCards(player.seat)),
    resolve: ({ inv, api }) => {
      const targets = api.investigatorsAt(inv.location).filter(player => api.canDrawCards(player.seat))
      if (!targets.length) return
      const seat = targets.length === 1 ? targets[0].seat : Number(api.choice({
        kind: 'investigator',
        source: '60202',
        seat: inv.seat,
        prompt: '选择要抽牌的调查员。',
        options: targets.map(player => ({ id: String(player.seat), label: player.name })),
      }))
      api.drawCards(seat, 1)
    },
  }],
}
