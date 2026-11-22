// 60328 小偷小摸
// 卡面：调查。本次调查不使用[intellect]，改为使用[agility]。如果你成功，额外发现你所在地点的2个线索。如果你成功超过难度至少2点，你的回合结束时将小偷小摸返回手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60328',
  abilities: [{
    kind: 'played', countsAs: 'investigate',
    label: '用敏捷调查；成功额外发现 2 线索，超过难度至少 2 点回合结束收回',
    resolve: ({ inv, api, context }) => api.investigate(inv.seat, {
      skill: 'agility', clueBonus: 2,
      onInvestigateSuccess: result => {
        if (result.value - result.difficulty >= 2) api.returnPlayedEventAtEndOfTurn(context)
      },
    }),
  }],
}
