// 08064 先见（Foresight）· 秘术师事件 · 1 经验。
//
// 卡面：快速。在你所在地点的调查员将要从其牌库或遭遇牌库抽取卡牌时打出。
//       指定一张卡牌。如果抽取的卡牌是指定的卡牌，该调查员可以(选择一项)：
//       - 取消该卡牌的效果并将其弃掉。- 立刻打出该卡牌且其费用 -2。
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation: 引擎没有「抽牌前指定卡名并在抽牌管线里按卡名匹配」的读点。这里挂在
// cardDrawn / encounterDrawn 窗口上，按「先指定（从该调查员手牌与该牌库可见候选中选名）→ 再比对
// 刚抽到的卡」近似；「打出且费用 -2」用 api.playCard({discount:2})，取消玩家牌=弃掉该卡，
// 取消遭遇牌=把 context.cancelled 置真（显现被取消）。
export default {
  code: '08064',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: ['cardDrawn', 'encounterDrawn'],
      label: '快速：指定一张卡牌；若抽到的就是它，取消其效果并弃掉，或立刻以 -2 费打出',
      criteria: [({ state, inv, context }) => Boolean(context) && Number.isInteger(context.seat)
        && state.investigators[context.seat]?.location === inv.location],
      resolve: ({ state, inv, context, api }) => {
        if (!context) return
        const drawer = state.investigators[context.seat]
        if (!drawer) return
        const drawnCode = context.cardCode || null
        const candidateCodes = [...new Set([
          ...(drawnCode ? [drawnCode] : []),
          ...(Array.isArray(drawer.hand) ? drawer.hand : []),
          ...(Array.isArray(drawer.deck) ? drawer.deck : []),
        ])]
        if (!candidateCodes.length) {
          api.info('「先见」：没有可以指定的卡牌。')
          return
        }
        const named = candidateCodes.length === 1 ? candidateCodes[0]
          : api.choice({ kind: 'card', source: '08064', seat: inv.seat,
            prompt: '指定一张卡牌（抽到的若是它，就可以取消/以 -2 费打出）。',
            options: candidateCodes.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        if (!drawnCode || named !== drawnCode) {
          api.info(`🔮 「先见」：指定了「${api.cardName(named)}」，但抽到的不是它。`)
          return
        }
        const options = [{ id: 'cancel', label: '取消该卡牌的效果并将其弃掉' }]
        if (context.when === 'cardDrawn') options.push({ id: 'play', label: '立刻打出该卡牌（费用 -2）' })
        const answer = options.length === 1 ? 'cancel'
          : api.choice({ kind: 'effect', source: '08064', seat: inv.seat,
            prompt: `「先见」：抽到了指定的「${api.cardName(named)}」，选择一项。`, options })
        if (answer === 'play') {
          if (!api.playCard(drawer.seat, drawnCode, { discount: 2, noAction: true })) {
            api.info(`「先见」：「${api.cardName(drawnCode)}」当前不能打出。`)
          } else {
            api.info(`🔮 「先见」：以 -2 费用打出「${api.cardName(drawnCode)}」。`)
          }
          return
        }
        if (context.when === 'encounterDrawn') {
          context.cancelled = true
          api.info(`🔮 「先见」：取消遭遇牌「${api.cardName(drawnCode)}」的效果。`)
          return
        }
        api.discardFromHand(drawer.seat, drawnCode)
        api.info(`🔮 「先见」：将抽到的「${api.cardName(drawnCode)}」弃掉。`)
      },
    },
  ],
  modifiers: [],
}
