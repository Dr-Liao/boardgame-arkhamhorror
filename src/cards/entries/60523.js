const code = '60523'

export default {
  code,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'treachery',
    label: '取消此处抽到的非弱点诡计的显现，然后检定意志（3）。若失败，放逐本卡',
    criteria: ({ inv, context }) => context.location === inv.location
      && !context.weakness && !context.cancelled && !context.cannotCancel,
    resolve: ({ api, inv, context }) => {
      if (!api.playerTools.cancelRevelation(context)) return
      api.test(inv.seat, 'willpower', 3, {
        source: { code, label: api.cardName(code) },
        resolve: result => {
          if (!result.success) api.exilePlayedEvent(context)
        },
      })
    },
  }],
}
