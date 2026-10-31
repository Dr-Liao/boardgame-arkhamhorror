// 06330 噩梦球
// 卡面：每套牌库仅限1张。
//       强制 - 噩梦球入场后：查找你的绑定卡牌，找出3张梦境寄生物，将它们附属到噩梦球。
//       在噩梦球离场时，将附属的每张梦境寄生物放在一边，位于场外。
//       [reaction] 在你揭示[auto_fail]混乱标记时，将附属的一张梦境寄生物混洗入你的牌库：取消该标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06330 噩梦球（[[诅咒萦绕]]配件，绑定 3 张梦境寄生物 06331）：
//   · 入场强制：api.bonded.retrieve(seat,'06330',{ handCount:3 }) 把 3 张绑定副本全部取出（本卡「附属」的
//     3 张梦境寄生物由玩家手牌代表——见 note）；离场时 api.bonded.return 把散落各处的副本收回场外集合
//     （= 放在一边、位于场外），与卡面离场条款一致；
//   · 取消 [auto_fail]：符号揭示窗口在「取消判定之前」开能力层窗口，用 forced + 旧式 effect
//     （cancelSymbolToken）取消该标记；随后另一个 forced 把一张梦境寄生物混洗入牌库。
//   · 显式简化：3 张梦境寄生物用「加入手牌」代表「附属到噩梦球」——引擎没有把卡牌移入 attachments
//     后再取回到牌库的通用 API（findZoneCard 不扫描 attachments），这样入场/离场/洗回三条读点才闭合。
//     取消标记（卡面主效果）与洗回牌库均已实现。

export default {
  code: '06330',
  simplified: true,
  note: '简化：「3 张梦境寄生物附属到噩梦球」用手牌代表附属（引擎无法把 attachments 里的卡再移回牌库/场外）。'
    + '取消 [auto_fail] 标记、洗一张梦境寄生物入牌库、离场时把副本收回场外集合均已实现。',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场强制：查找绑定卡牌，取出 3 张梦境寄生物（由手牌代表附属）',
      resolve: ({ inv, api }) => {
        api.bonded.retrieve(inv.seat, '06330', { handCount: 3 })
        api.info(`🌑 「${api.cardName('06330')}」入场：3 张梦境寄生物加入手牌（代表附属在它上面）。`)
      },
    },
    {
      kind: 'leavesPlay',
      label: '离场：把每张梦境寄生物放在一边，位于场外',
      resolve: ({ inv, api }) => {
        api.bonded.return(inv.seat, '06330')
        api.info(`🌑 「${api.cardName('06330')}」离场：梦境寄生物全部放在一边，位于场外。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'symbolRevealed',
      id: 'nightmareBaubleCancel',
      legacyReaction: true,
      label: '揭示 [auto_fail] 时：取消该标记',
      criteria: [({ context }) => context?.token === 'autofail'],
      effect: { type: 'cancelSymbolToken', code: '06330' },
    },
    {
      kind: 'forced',
      trigger: 'symbolRevealed',
      id: 'nightmareBaubleShuffle',
      label: '揭示 [auto_fail] 后：把一张梦境寄生物混洗入你的牌库',
      criteria: [({ context, inv }) => context?.token === 'autofail' && (inv?.hand || []).includes('06331')],
      resolve: ({ inv, api }) => {
        if (!(inv.hand || []).includes('06331')) return
        api.moveCard({ code: '06331', from: 'hand', to: 'deckTop' })
        api.shuffleDeck(inv.seat)
        api.info(`🌑 把一张梦境寄生物混洗入 ${inv.name} 的牌库。`)
      },
    },
  ],
  modifiers: [],
}
