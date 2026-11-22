const CODE = '60513'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'treachery',
    label: '此处抽到非弱点诡计时：检定意志（3）。成功则取消显现',
    criteria: ({ inv, context }) => context.location === inv.location
      && !context.weakness && !context.cancelled && !context.cannotCancel,
    resolve: ({ api, inv, context }) => {
      api.test(inv.seat, 'willpower', 3, {
        source: { code: CODE, label: api.cardName(CODE) },
        resolve: result => {
          if (result.success) api.playerTools.cancelRevelation(context)
        },
      })
    },
  }],
}
