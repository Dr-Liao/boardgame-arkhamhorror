// 06203 月石：从手牌实际弃掉后，可支付费用将弃牌堆中的本卡打出。
export default {
  code: '06203',
  playCondition: [{ when: () => false, message: '月石不能从手牌中打出，只能通过其[reaction]效果打出' }],
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'handCardDiscarded',
      label: '从手牌弃掉月石后：支付费用将其打出',
      criteria: [({ inv, context }) => context?.seat === inv.seat
        && context.cardCode === '06203' && inv.discard.includes('06203')
        && (inv.resources || 0) >= 3],
      resolve: ({ inv, api }) => {
        if (!api.moveCard({ code: '06203', from: 'discard', to: 'hand', ownerSeat: inv.seat })) return
        api.playCard(inv.seat, '06203', { noAction: true })
        api.info(`${inv.name} 弃掉「月石」后支付费用将其打出。`)
      },
    },
  ],
}
