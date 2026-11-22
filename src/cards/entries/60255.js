// 60255 梦中编年史（Dreamer's Chronicle）
// 卡面：使用(4秘密)。[action] 花 1 秘密：调查([intellect])。本次调查你投入的第一张卡获得[wild]。
// 成功时你可以受到 1 点恐惧，以发现你所在地点额外 1 个线索。
// 读点：uses/usesType secrets + action 描述子 cost.uses（引擎统一付费读点）；
// api.investigate（统一调查管线）；「第一张投入卡获得 wild」= api.addCommittedExtraIcons（committedCard 反应）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60255'

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '花 1 秘密：调查；成功可受 1 恐惧换 1 额外线索',
      cost: { action: true, uses: 1 },
      countsAs: 'investigate',
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, {
          source: CODE,
          onSuccess: () => {
            const choice = api.choice({
              kind: 'choice', source: CODE, seat: inv.seat, canSkip: true,
              prompt: '是否受到 1 点恐惧以发现额外 1 个线索？',
              options: [
                { id: 'skip', label: '不受到恐惧' },
                { id: 'horror', label: '受到 1 点恐惧，发现 1 个额外线索' },
              ],
            })
            if (choice !== 'horror') return
            api.horror(inv.seat, 1)
            if (!inv.defeated && !inv.resigned) api.discoverClue(inv.seat, 1, inv.location)
          },
        })
      },
    },
    {
      kind: 'reaction',
      trigger: 'committedCard',
      label: '本次调查投入的第一张卡获得 1 个万能图标',
      criteria: [({ state, inv, context }) => context?.cardCode === CODE && context?.seat === inv.seat
        && state.skillTest?.actionKind === 'investigate'],
      resolve: ({ api }) => api.addCommittedExtraIcons('wild'),
    },
  ],
  note: 'approximation: 印刷效果是「本次调查投入的第一张卡获得 wild」；实现为投入本卡后由 committedCard 反应给该次检定 +1 wild（未限定是否为第一张）。',
  modifiers: [],
}
