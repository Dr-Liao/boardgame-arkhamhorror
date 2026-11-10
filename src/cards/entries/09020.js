// 09020「领导的重担」（Burden of Leadership）· 诡计 · 查理专属弱点
// 卡面：显现 - 若你不控制任何 [[盟友]] 支援，将「领导的重担」洗回你的牌库。
//   否则，对每名你控制的 [[盟友]] 支援，你必须选择：横置它，或对它造成 1 点直接伤害和 1 点直接恐惧。
export default {
  code: '09020',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'threat' },
      label: '显现：每名盟友横置，或各受 1 直接伤害与恐惧；无盟友则洗回牌库',
      resolve: ({ inv, api }) => {
        const allies = (inv.assets || []).filter(asset => (api.cardTraits(asset.code) || [])
          .some(trait => String(trait).toLowerCase() === 'ally'))
        if (!allies.length) {
          api.moveCard({ code: '09020', from: 'discard', to: 'deck', ownerSeat: inv.seat })
          api.shuffleDeck(inv.seat)
          api.info('「领导的重担」被洗回牌库。')
          return
        }
        for (const ally of allies) {
          const answer = api.choice({
            kind: 'target', source: '09020', seat: inv.seat,
            prompt: `「${api.cardName(ally.code)}」：横置，或受到 1 点直接伤害与 1 点直接恐惧？`,
            options: [{ id: 'exhaust', label: '横置' }, { id: 'harm', label: '承受 1 直接伤害与 1 直接恐惧' }],
          })
          if (answer === 'harm') {
            api.investigatorTools.setAssetDamage(ally, 1)
            api.addAssetHorror(ally, 1)
            api.info(`💢「${api.cardName(ally.code)}」受到 1 点直接伤害和 1 点直接恐惧。`)
          } else {
            api.exhaust(ally)
          }
        }
      },
    },
  ],
  modifiers: [],
}
