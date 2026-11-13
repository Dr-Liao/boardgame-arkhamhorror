// 09044 凄惨传略（Grim Memoir）· 探求者资产 · 手槽 · 使用(4 秘密) · 费用 3。
// 卡面：使用(4 秘密)。
//       [action] 花费 1 秘密：调查。你本次调查得到 +2[intellect]。如果你检定成功且超过难度至少 2 点，
//       你可以抽取 1 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：花费秘密由 cost.uses:1 结算；调查走 api.investigate(inv.seat, { bonus: 2 })，返回后读
// api.testResult() 的 successBy，>=2 时询问并 api.drawCards（「你可以」）。
export default {
  code: '09044',
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '花 1 秘密：调查 +2[智力]；成功且超过难度至少 2 可抽 1 张',
      cost: { action: true, uses: 1 },
      criteria: [({ state, inv }) => (state.locations.find(item => item.id === inv.location)?.clues || 0) > 0],
      resolve: ({ state, inv, api }) => {
        api.investigate(inv.seat, { bonus: 2, sourceCode: '09044' })
        const result = api.testResult()
        if (!result?.success) return
        if ((result.value - result.difficulty) < 2) return
        const answer = api.choice({
          kind: 'effect', source: '09044', seat: inv.seat,
          prompt: '凄惨传略：成功超过 2 点，抽取 1 张卡牌？',
          options: [{ id: 'draw', label: '抽 1 张牌' }, { id: 'skip', label: '不抽' }],
        })
        if (answer === 'draw') api.drawCards(inv.seat, 1)
      },
    },
  ],
  modifiers: [],
}
