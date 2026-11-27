// 09618 费尔班克斯 · 地点（onThinIce）
export default {
  code: '09618',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 2, printedClues: 0 },
  abilities: [{
    kind: 'reaction', trigger: 'encounterDrawn',
    label: '花费 2 个资源取消在费尔班克斯抽到的[[危险]]诡计',
    cost: { resources: 2 },
    criteria: ({ inv, source, context, helpers }) => {
      const card = helpers.cardDef(context.cardCode)
      return inv.location === source.id && context.location === source.id
        && context.cannotCancel !== true && !context.cancelled && (!context.peril || context.seat === inv.seat)
        && card?.type === 'treachery' && card.traits?.includes('Hazard')
    },
    resolve: ({ context }) => { context.cancelled = true },
  }],
}
