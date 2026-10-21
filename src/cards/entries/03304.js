// 03304 “吃枪子吧！”
// 卡面：快速。在你激活[[枪械]]支援上的攻击能力时打出。
// 卡面：你可以花费该支援上的额外X子弹标记。在你为本次攻击揭示混乱标记时，额外揭示X个混乱标记。选择其中一个结算并忽略其余标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03304 吃子弹：启动枪械攻击时快速打出——多花 N 发弹药，本次检定额外揭示 N 个混乱标记。

export default {
  code: '03304',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'activateFirearmFight',
      label: '额外花费弹药，换取本次检定额外揭示的混乱标记',
      resolve: ({ inv, api }) => {
        const context = api.reactionContext()
        const assetId = context?.assetId ?? context?.context?.assetId ?? null
        const firearm = (assetId && inv.assets.find(card => card.id === assetId))
          || inv.assets.find(card => api.cardTraits(card.code).includes('firearm') && (card.uses || 0) > 0)
        if (!firearm) return
        const amount = Number(api.choice({ kind: 'amount', source: '03304', seat: inv.seat,
          prompt: '选择额外花费的弹药。',
          options: Array.from({ length: firearm.uses + 1 }, (_, value) => ({ id: String(value), label: `${value}弹药` })) }))
        api.addUses(firearm, -amount)
        api.addExtraChaosChoicesToTest(amount)
      },
    },
  ],
  modifiers: [

  ],
}
