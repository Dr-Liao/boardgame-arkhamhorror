// 09014「震耳欲聋的寂静」（Deafening Silence）· 诡计 · 阿米娜专属弱点
// 卡面：显现 - 从你控制的一张支援上移动 1 个毁灭标记到当前密谋上。这可能使当前密谋推进。
//   若没有以此法移动毁灭标记，将「震耳欲聋的寂静」洗回你的牌库。
export default {
  code: '09014',
  abilities: [
    {
      kind: 'weakness',
      weakness: { type: 'threat' },
      label: '显现：把支援上的 1 个毁灭移动到当前密谋；没有则洗回牌库',
      resolve: ({ inv, api }) => {
        const sources = (inv.assets || []).filter(asset => (Number(asset.doom) || 0) > 0)
        if (!sources.length) {
          api.moveCard({ code: '09014', from: 'discard', to: 'deckTop', ownerSeat: inv.seat })
          api.shuffleDeck(inv.seat)
          api.info('「震耳欲聋的寂静」被洗回牌库。')
          return
        }
        const source = sources.length === 1 ? sources[0] : sources[Number(api.choice({
          kind: 'target', source: '09014', seat: inv.seat, prompt: '选择要移走毁灭标记的支援。',
          options: sources.map((asset, index) => ({ id: String(index), label: `${api.cardName(asset.code)}（毁灭 ${asset.doom}）` })),
        }))]
        if (!source) return
        api.removeDoomFromCard(source, 1)
        api.addDoom(1)
        api.info(`🕯️ 1 个毁灭标记从「${api.cardName(source.code)}」移到当前密谋。`)
      },
    },
  ],
  modifiers: [],
}
