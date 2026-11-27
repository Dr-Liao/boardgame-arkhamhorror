// 08049 反间谍活动
// 跨调查员取消显现必须额外支付 2；可另加 2 改从打出者自己的牌库抽牌。
const code = '08049'

export default {
  code,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      label: '打出反间谍活动时：提升费用 2 点，改抽自己的牌库',
      criteria: ({ inv, context }) => context?.cardCode === code && context.seat === inv.seat
        && !context.playUpgrades?.yourDeck
        && (context.availableResources ?? inv.resources ?? 0)
          >= (context.cost || 0) + (context.costIncrease || 0) - (context.costReduction || 0) + 2,
      resolve: ({ context }) => {
        context.playUpgrades = { ...context.playUpgrades, yourDeck: true }
        context.costIncrease = (context.costIncrease || 0) + 2
      },
    },
    {
      kind: 'played',
      fast: true,
      range: 'anywhere',
      trigger: 'treachery',
      windowCostIncrease: ({ inv, context }) => inv.seat === context.seat ? 0 : 2,
      useBeforePlayCost: true,
      label: '取消一张非弱点诡计的显现并抽牌；对其他调查员使用多付 2 资源',
      criteria: ({ context }) => context?.when === 'treachery'
        && !context.weakness && !context.cancelled && !context.cannotCancel,
      resolve: ({ inv, context, api }) => {
        if (!api.playerTools.cancelRevelation(context)) return
        if (context.playCost?.playUpgrades?.yourDeck) api.drawCards(inv.seat, 1)
        else api.drawEncounter(inv.seat)
      },
    },
  ],
  modifiers: [],
}
