import { ALL_CARDS } from '../cards-data.js'

const code = '60521'

export default {
  code,
  abilities: [{
    kind: 'forced',
    trigger: 'assetDefeated',
    label: '因伤害被击败时：放逐本卡',
    criteria: ({ source, context }) => context.assetId === source?.id
      && context.damage >= ALL_CARDS[code].health,
    resolve: ({ context, api }) => api.exileAssetInstead(context),
  }],
}
