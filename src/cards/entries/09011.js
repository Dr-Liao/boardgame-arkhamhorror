// 09011 阿米娜·齐达内（Amina Zidane）· 神秘学家 · 被选中者
// 卡面：
//   [reaction] 当你打出一张支援时：其资源费用减少 3。它以 1 个毁灭标记入场。（每轮限一次）
//   [elder_sign] 效果：+2。你可以把同地点一张卡上的所有毁灭移动到同地点另一张卡上。
//
// 读点：
//   · 减费：支付前窗口 `beforePlayCost`（actions.js），在 context.costReduction 写减免（同 06198）；
//   · 入场毁灭：`assetEnteredPlay` 窗口 + api.placeDoomOnCard（同 01063/02232）。
export default {
  code: '09011',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 2 } },
  elderSign: {
    id: '09011-eldersign',
    label: '阿米娜旧印：+2；可把同地点一张卡上的所有毁灭移到另一张卡上',
    resolve: ({ state, inv, api }) => {
      const cards = []
      for (const card of [...(inv.assets || []), ...(inv.threat || [])]) cards.push({ card, label: api.cardName(card.code) })
      for (const enemy of state.enemies || []) if (enemy.location === inv.location) cards.push({ card: enemy, label: enemy.name })
      for (const asset of (state.players || []).flatMap(player => player.assets || [])) {
        if (asset.location == null) {
          const owner = state.investigators.find(other => other.assets?.includes(asset))
          if (owner && owner.location === inv.location) cards.push({ card: asset, label: api.cardName(asset.code) })
        }
      }
      const withDoom = cards.filter(item => (item.card.doom || 0) > 0)
      if (!withDoom.length) return { delta: 2 }
      const from = withDoom.length === 1 ? withDoom[0] : withDoom[Number(api.choice({
        kind: 'target', source: '09011', seat: inv.seat, prompt: '选择要移走毁灭的卡。',
        options: withDoom.map((item, index) => ({ id: String(index), label: `${item.label}（毁灭 ${item.card.doom}）` })),
      }))]
      const targets = cards.filter(item => item.card !== from.card)
      if (!targets.length) return { delta: 2 }
      const to = targets.length === 1 ? targets[0] : targets[Number(api.choice({
        kind: 'target', source: '09011', seat: inv.seat, prompt: '选择要放置毁灭的卡。',
        options: targets.map((item, index) => ({ id: String(index), label: item.label })),
      }))]
      const amount = from.card.doom || 0
      api.removeDoomFromCard(from.card, amount)
      api.placeDoomOnCard(to.card, amount)
      return { delta: 2 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      limit: 'oncePerRound',
      label: '打出支援时：费用 -3，且以 1 个毁灭标记入场（每轮限一次）',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && Boolean(context?.cardCode)
        && context.cardType === 'asset'],
      resolve: ({ inv, context, api }) => {
        context.costReduction = (Number(context.costReduction) || 0) + 3
        api.investigatorTools.noteDoomOnNextAsset(inv.seat)
        api.info(`💸 阿米娜：「${api.cardName(context.cardCode)}」费用减少 3，并将以 1 个毁灭标记入场。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetEnteredPlay',
      limit: 'oncePerRound',
      label: '阿米娜减费打出的支援以 1 个毁灭标记入场',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat && state.investigators[inv.seat]?.aminaDoomPending === true],
      resolve: ({ state, inv, context, api }) => {
        api.investigatorTools.takeDoomOnNextAsset(inv.seat)
        const asset = (state.investigators[inv.seat]?.assets || []).find(item => item.id === context.assetId)
        if (asset) api.placeDoomOnCard(asset, 1)
      },
    },
  ],
  modifiers: [],
}

