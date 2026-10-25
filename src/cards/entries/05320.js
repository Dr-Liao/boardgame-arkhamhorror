// 05320 超级加倍
// 卡面：卓越。
// 卡面：[reaction]在你打出一张事件后，横置超级加倍：再次打出该事件，如同其在你手牌中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05320 超级加倍：挂在新接线的 eventPlayed 窗口上的 reaction；横置自身后
// 用 api.replayEventAsHand 把刚打出的事件「如同在手中」再打出一次：
// 从实际落点（弃牌堆）取出 → 走真实 doPlay（支付印刷费用、重新结算打出效果、结算后正常进弃牌堆）。

export default {
  code: '05320',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'eventPlayed',
      cost: { exhaust: true },
      label: '横置：再次打出刚打出的事件',
      criteria: ctx => ctx.context?.seat === ctx.inv?.seat
        && Boolean(ctx.context?.cardCode || ctx.context?.cardId)
        && (ctx.context?.cardCode || ctx.context?.cardId) !== '05320',
      resolve: ({ inv, context, api }) => {
        const code = context?.cardCode || context?.cardId
        if (!code) return
        const replayed = api.replayEventAsHand(inv.seat, code)
        if (!replayed) {
          api.info(`「超级加倍」无法再次打出「${api.cardName(code)}」（该事件已不在弃牌堆）。`)
          return
        }
        api.info(`${inv.name} 用「超级加倍」再次打出了「${api.cardName(code)}」。`)
      },
    },
  ],
  modifiers: [

  ],
}
