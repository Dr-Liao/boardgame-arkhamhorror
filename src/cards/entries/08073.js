// 08073 绷带（Bandages）· 幸存者（Survivor）资产 · 0 经验。
//
// 卡面：使用(3 补给)。如果绷带没有补给，将其弃掉。
//       [reaction] 在你所在地点的调查员或 [[盟友]] 支援受到 1 点或更多伤害后，花费 1 补给：
//       治愈该卡牌 1 点伤害。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：
//   · 调查员受伤窗口 = harmAssigned（context.seat / damage，enemies.js#applyHarm 末尾）；
//   · 盟友支援受伤窗口 = assetHarmPlaced（context.assetId / damage / seat=控制者）。
// 费用 uses:1 由引擎扣补给；治愈用 api.healDamage / api.healAsset。
export default {
  code: '08073',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'harmAssigned',
      label: '同地点调查员受伤后：花费 1 补给，治愈其 1 点伤害',
      cost: { uses: 1 },
      criteria: [({ state, inv, context }) => Boolean(context)
        && (context.damage || 0) > 0
        && Number.isInteger(context.seat)
        && state.investigators[context.seat]?.location === inv.location],
      resolve: ({ context, api }) => {
        api.healDamage(Number(context.seat), 1)
        api.info(`🩹 「绷带」治愈了 ${context.seat != null ? '' : ''}同地点调查员 1 点伤害。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetHarmPlaced',
      label: '同地点盟友支援受伤后：花费 1 补给，治愈该支援 1 点伤害',
      cost: { uses: 1 },
      criteria: [({ state, inv, context }) => {
        if (!context || (context.damage || 0) <= 0 || !context.assetId) return false
        const owner = state.investigators.find(person => (person.assets || []).some(asset => asset.id === context.assetId))
        return Boolean(owner) && owner.location === inv.location
      }],
      resolve: ({ state, context, api }) => {
        const owner = state.investigators.find(person => (person.assets || []).some(asset => asset.id === context.assetId))
        const asset = owner?.assets.find(item => item.id === context.assetId)
        if (!asset) return
        api.healAsset(asset, { damage: 1 })
        api.info(`🩹 「绷带」治愈了「${api.cardName(asset.code)}」1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
