import { ALL_CARDS } from '../cards-data.js'

const code = '60520'

export default {
  code,
  abilities: [{
    kind: 'forced',
    trigger: 'assetDefeated',
    label: '因恐惧被击败时：放逐本卡',
    criteria: ({ source, context }) => context.assetId === source?.id
      && context.horror >= ALL_CARDS[code].sanity,
    resolve: ({ context, api }) => api.exileAssetInstead(context),
  }],
}
