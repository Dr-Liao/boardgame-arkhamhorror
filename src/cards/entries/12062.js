// 12062 第二视觉（Second Sight）
// 卡面：使用(3充能)。
//       [action]：调查([willpower])。如果你检定成功，你可以花费1充能，以在你所在地点额外发现1个线索。
//       如果你本次检定期间揭示了[cultist]标记，移除第二视觉的1充能（如果你不能这么做，受到1点恐惧并弃掉本卡牌）。
//
// 读点：
//   · 充能 → uses/usesType；
//   · 调查（意志）→ api.investigate({ skill:'willpower', assetId })；
//   · 成功后可选花 1 充能额外发现 1 线索 → actions.js#runInvestigate 的 onInvestigateSuccess 回调 +
//     api.spendUses + api.discoverClue；
//   · 揭示[cultist]后移除充能（无充能则 1 恐惧 + 弃牌）→ forced 'symbolRevealed' 窗口 + context.token +
//     skillTest.source.assetId 精确匹配本实例。
const CODE = '12062'

export default {
  code: CODE,
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      cost: { action: true },
      label: '调查（意志）：成功后可选花 1 充能，在所在地点额外发现 1 个线索',
      resolve: ({ inv, source, api }) => {
        api.investigate(inv.seat, {
          skill: 'willpower', assetId: source?.id, trackAssetSource: true,
          onInvestigateSuccess: () => {
            const asset = (inv.assets || []).find(item => item.id === source?.id)
            if (!asset || (asset.uses || 0) <= 0) return
            const answer = api.choice({
              kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
              prompt: '「第二视觉」：是否花费 1 充能，在所在地点额外发现 1 个线索？',
              options: [{ id: 'spend', label: '花费 1 充能' }, { id: 'skip', label: '不花费' }],
            })
            if (answer !== 'spend') return
            if (!api.spendUses(asset, 1)) return
            const got = api.discoverClue(inv.seat, 1)
            api.info(`👁️「第二视觉」：花费 1 充能，额外发现 ${got} 个线索。`)
          },
        })
      },
    },
    {
      kind: 'forced',
      trigger: 'symbolRevealed',
      limit: { scope: 'perTest', owner: 'instance' },
      label: '本次检定揭示[cultist]：移除 1 充能；无充能则受 1 恐惧并弃掉本卡牌',
      criteria: [({ state, source, context }) => context?.token === 'cultist'
        && state.skillTest?.source?.assetId === source?.id],
      resolve: ({ inv, source, api }) => {
        const asset = (inv.assets || []).find(item => item.id === source?.id)
        if (!asset) return
        if ((asset.uses || 0) > 0) {
          api.setAssetUses(asset, (asset.uses || 0) - 1)
          api.info(`👁️「第二视觉」因[cultist]移除 1 充能（剩余 ${asset.uses || 0}）。`)
          return
        }
        api.horror(inv.seat, 1)
        api.discardAsset(inv.seat, asset)
        api.info(`👁️「第二视觉」没有充能可移除：${inv.name} 受到 1 点恐惧并弃掉本卡牌。`)
      },
    },
  ],
  modifiers: [],
}
