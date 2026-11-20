import { ownSeat } from '../../engine/matcher.js'

const code = '11059'
const stored = host => host?.attachments?.find(card => card.facedown)

export default {
  code,
  abilities: [
    {
      kind: 'action', cost: { action: true, resources: 2 }, label: '花 2 资源：抽取附属的卡牌',
      criteria: ({ inv, source, helpers }) => Boolean(stored(source))
        && !inv.storyInvestigator && !helpers.capabilityBlocked('drawCards'),
      resolve: ({ inv, source, api }) => {
        const card = stored(source)
        if (card) api.movePlayerAttachment(card, 'hand', { draw: true, seat: inv.seat })
      },
    },
    {
      kind: 'reaction', trigger: 'assetLeavesPlay', cost: { exhaust: true },
      label: '你控制的非法支援被弃置时横置：将它正面朝下附属，限 1 张',
      criteria: [ownSeat(), ({ source, context, helpers }) => source != null && context.asset && context.asset !== source
        && context.reason === 'discard' && !stored(source)
        && helpers.cardTraits(context.asset.code).some(trait => trait.toLowerCase() === 'illicit')],
      resolve: ({ source, context, api }) => api.attachDepartingAsset(source, context, { facedown: true }),
    },
  ],
}
