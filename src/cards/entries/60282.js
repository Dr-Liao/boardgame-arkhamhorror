// 60282 联通宇宙（Commune with the Cosmos，5 级）
// 卡面：在你打出联通宇宙时，你可以受到最多 3 点恐惧。
// 调查([intellect])。本次调查 +2[intellect]。成功时发现你所在地点额外 X 个线索，X 为你身上的恐惧数量（最多额外 4 个）。
// 读点：played countsAs investigate + api.test（可选恐惧作为额外费用）+ api.discoverClue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60282'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'investigate',
    label: '可受至多 3 恐惧：调查 +2；成功发现额外 X 线索（X=恐惧数，最多 4）',
    resolve: ({ inv, api }) => {
      const answer = api.choice({
        kind: 'choice', source: CODE, seat: inv.seat,
        prompt: '打出联通宇宙时是否受到恐惧？',
        options: [0, 1, 2, 3].map(amount => ({
          id: String(amount), label: amount === 0 ? '不受到恐惧' : '受到 ' + amount + ' 点恐惧',
        })),
      })
      const horror = Math.max(0, Math.min(3, Number(answer) || 0))
      if (horror > 0) api.horror(inv.seat, horror)
      if (inv.defeated || inv.resigned) return
      api.investigate(inv.seat, {
        skillBonus: 2, source: CODE,
        onSuccess: () => {
          const extra = Math.min(4, Number(inv.horror) || 0)
          if (extra > 0) api.discoverClue(inv.seat, extra, inv.location)
        },
      })
    },
  }],
  modifiers: [],
}
