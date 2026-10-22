// 04267 养神术
// 卡面：使用(3秘密)。
// 卡面：[action]横置养神术并花费1秘密：检定[intellect](0)。你检定成功且每超过难度一点，抽取1张卡牌。然后，你手牌每超出上限一张，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04267 养神术：意志检定(0)，按成功点数抽牌，再按超出手牌上限受恐惧。

export default {
  code: '04267',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action', label: '养神', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.startTest({
          skill: 'intellect', difficulty: 0, seat: inv.seat,
          source: { label: '养神术', code: '04267' },
          resolve: result => {
            if (!result.success) return
            api.drawCards(inv.seat, Math.max(0, result.value))
            const overflow = Math.max(0, (inv.hand || []).length - api.handSize(inv.seat))
            if (overflow) api.applyHorror(inv.seat, overflow)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
