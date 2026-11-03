// 06023 骇人真相
// 卡面：多重。不能打出骇人真相。
//       [reaction]在你查找你的牌库时，若查找过的卡牌中有骇人真相，将其弃掉：
//       获得2资源，或在你控制的一个支援上放置1秘密。(每次查找最多使用1次[[研究]]能力。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06023 骇人真相：
//   · 「查找牌库时被发现 → 弃掉」走 P6 原语 searchedCardRule（读点 deck-ops.js），mode reaction = 先询问。
//   · 「不能打出」用 playCondition 恒假表示。
//   · searchedCardRule.resolve 在弃掉本卡后选择资源，或在一张己控支援上放置秘密。

export default {
  code: '06023',
  playCondition: [
    { when: () => false, message: '「骇人真相」不能打出' },
  ],
  searchedCardRule: {
    mode: 'reaction',
    condition: ({ inv, owner }) => Boolean(inv && owner && inv.seat === owner.seat),
    label: '骇人真相：弃掉它，并获得 2 资源或在支援上放置 1 秘密',
    prompt: '查找的牌中有「骇人真相」：弃掉它并获得奖励？',
    discard: true,
    resolve: ({ inv, api }) => {
      const assets = inv.assets || []
      const answer = assets.length ? api.choice({
        kind: 'effect', source: '06023', seat: inv.seat,
        prompt: '获得 2 资源，或选择一张你控制的支援放置 1 秘密。',
        options: [
          { id: 'resources', label: '获得 2 资源' },
          ...assets.map(asset => ({ id: asset.id, cardCode: asset.code,
            label: `在「${api.cardName(asset.code)}」上放置 1 秘密` })),
        ],
      }) : 'resources'
      const asset = assets.find(item => item.id === answer)
      if (asset) api.placeUse(asset, 'secret', 1)
      else api.gainResources(inv.seat, 2)
    },
  },
  modifiers: [],
}
