// 09016「达雷尔的柯达相机」（Darrell's Kodak）· 支援 · 达雷尔专属签名
// 卡面：达雷尔牌库专用。
//   [reaction] 在一个敌人或诡计进入游戏后，横置柯达相机：从标记池放置 1 个资源到该敌人或诡计上，作为证据。
//   [reaction] 在你发现任意数量线索后：把该地点（或不在任何地点）的敌人/诡计上同等数量的证据移到柯达相机上。
//
// 读点：证据 = 卡牌计数器 'evidence'（P2 通用原语 api.addCardCounter/moveCardCounters）；
//   敌人进入 play 窗口 enemySpawn；诡计进入窗口 threatEntered；发现线索窗口 clueDiscovered。
export default {
  code: '09016',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemySpawn',
      label: '敌人进入游戏后：横置柯达，在其上放 1 个证据',
      cost: { exhaust: true },
      criteria: [({ context }) => Boolean(context?.enemy)],
      resolve: ({ context, api }) => {
        if (context?.enemy) api.addCardCounter(context.enemy, 'evidence', 1)
      },
    },
    {
      kind: 'reaction',
      trigger: 'threatEntered',
      label: '诡计进入游戏后：横置柯达，在其上放 1 个证据',
      cost: { exhaust: true },
      criteria: [({ context }) => Boolean(context?.card || context?.threat || context?.cardId)],
      resolve: ({ context, api }) => {
        const card = context?.card || context?.threat
        if (card) api.addCardCounter(card, 'evidence', 1)
      },
    },
    {
      kind: 'reaction',
      trigger: 'clueDiscovered',
      label: '发现线索后：把该地点敌人/诡计上同等数量的证据移到柯达',
      criteria: [({ context }) => Number(context?.amount ?? context?.clues ?? 0) > 0],
      resolve: ({ state, inv, context, api }) => {
        const kodak = (inv.assets || []).find(asset => asset.code === '09016')
        if (!kodak) return
        let remaining = Number(context.amount ?? context.clues ?? 0)
        const cards = [
          ...(state.enemies || []).filter(enemy => enemy.location === context.location),
          ...(inv.threat || []),
        ].filter(card => api.cardCounterOf(card, 'evidence') > 0)
        for (const card of cards) {
          if (!remaining) break
          const amount = Math.min(remaining, api.cardCounterOf(card, 'evidence'))
          api.moveCardCounters(card, kodak, 'evidence', amount)
          remaining -= amount
        }
        if (remaining !== Number(context.amount ?? context.clues ?? 0)) {
          api.info(`📷 把 ${Number(context.amount ?? context.clues ?? 0) - remaining} 个证据移到柯达相机。`)
        }
      },
    },
  ],
  modifiers: [],
}
