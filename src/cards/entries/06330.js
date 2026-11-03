// 06330 噩梦球
// 卡面：每套牌库仅限1张。
//       强制 - 噩梦球入场后：查找你的绑定卡牌，找出3张梦境寄生物，将它们附属到噩梦球。
//       在噩梦球离场时，将附属的每张梦境寄生物放在一边，位于场外。
//       [reaction] 在你揭示[auto_fail]混乱标记时，将附属的一张梦境寄生物混洗入你的牌库：取消该标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 绑定副本入场后移到本卡附件；揭示自动失败时从附件移到牌库。
// 可选反应先把一张附属卡洗入牌库，再取消刚揭示的自动失败标记。

export default {
  code: '06330',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场强制：查找绑定卡牌，取出 3 张梦境寄生物（由手牌代表附属）',
      resolve: ({ inv, source, api }) => {
        api.bonded.retrieve(inv.seat, '06330', { handCount: 3 })
        for (let index = 0; index < 3; index++) api.moveCard({ code: '06331', from: 'hand', to: 'attached', attachTo: source.id, ownerSeat: inv.seat })
        api.info(`🌑 「${api.cardName('06330')}」入场：3 张梦境寄生物附属在它上面。`)
      },
    },
    {
      kind: 'leavesPlay',
      label: '离场：把每张梦境寄生物放在一边，位于场外',
      resolve: ({ inv, source, api }) => {
        api.bonded.return(inv.seat, '06330', { host: source })
        api.info(`🌑 「${api.cardName('06330')}」离场：梦境寄生物全部放在一边，位于场外。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'symbolRevealed',
      id: 'nightmareBaubleCancel',
      label: '揭示 [auto_fail] 时：将一张附属的梦境寄生物混洗入牌库并取消标记',
      criteria: [({ state, inv, context, source }) => context?.seat === inv.seat && context?.token === 'autofail'
        && state.skillTest?.cancelledSymbol !== context.token
        && (source?.attachments || []).some(card => card.code === '06331')],
      resolve: ({ inv, source, context, api }) => {
        const attached = (source.attachments || []).find(card => card.code === '06331')
        if (!attached) return
        api.moveCard({ id: attached.id, from: 'attached', to: 'deckTop', ownerSeat: inv.seat })
        api.shuffleDeck(inv.seat)
        api.cancelCurrentSymbol(context, { sourceCode: '06330' })
        api.info(`🌑 把一张梦境寄生物混洗入 ${inv.name} 的牌库。`)
      },
    },
  ],
  modifiers: [],
}
