// 09012「祸言之语」（Word of Woe）· 事件 · 阿米娜专属签名
// 卡面：阿米娜牌库专用。快速。仅可在你的回合期间打出。
//   在你控制的一张支援上放置 1 个毁灭标记，以结算它上面的一个 [action] 能力，忽略所有费用（含其 [action] 费用）。
//   然后，若「福言之语」在你的弃牌堆中，你可以将其洗回你的牌库。
export default {
  code: '09012',
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：在支援上放 1 毁灭，免费结算其 [action] 能力；可洗回「福言之语」',
      resolve: ({ inv, api }) => {
        const assets = (inv.assets || []).filter(asset => api.cardName(asset.code))
        if (!assets.length) return
        const asset = assets.length === 1 ? assets[0] : assets[Number(api.choice({
          kind: 'target', source: '09012', seat: inv.seat, prompt: '选择放置毁灭并结算 [action] 能力的支援。',
          options: assets.map((item, index) => ({ id: String(index), label: api.cardName(item.code) })),
        }))]
        if (!asset) return
        api.placeDoomOnCard(asset, 1)
        api.info(`🕯️ 在「${api.cardName(asset.code)}」上放置 1 个毁灭。`)
        const activated = api.beginImmediateAction(inv.seat, { source: '09012', actionKinds: ['activate'] })
        if (activated) api.info('按忽略费用的方式结算该支援的一个 [action] 能力（P5 以立即激活近似）。')
        if ((inv.discard || []).includes('09013')) {
          if (api.choice({ kind: 'target', source: '09012', seat: inv.seat, prompt: '是否将「福言之语」洗回牌库？',
            options: [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }] }) === 'yes') {
            api.moveCard({ code: '09013', from: 'discard', to: 'deckTop', ownerSeat: inv.seat })
            api.shuffleDeck(inv.seat)
          }
        }
      },
    },
  ],
  modifiers: [],
}
