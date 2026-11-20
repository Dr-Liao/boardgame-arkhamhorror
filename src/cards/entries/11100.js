import { ALL_CARDS } from '../cards-data.js'
import { ownSeat } from '../../engine/matcher.js'

const code = '11100'

export default {
  code,
  abilities: [
    {
      kind: 'commit',
      label: '仅诡计上的检定可投入；成功时置入你的游戏区域',
      skill: {
        commitCondition: ({ state, test }) => {
          const source = test?.source
          if (!source?.code) return false
          const card = state.cards?.[source.code] || ALL_CARDS[source.code]
          return card?.type === 'treachery'
        },
        destination: ({ result }) => result?.success ? 'play' : null,
      },
    },
    {
      kind: 'reaction', trigger: 'treachery',
      label: '抽到非险境的遭遇诡计时：将此牌移出游戏来取消其显现',
      criteria: [ownSeat(), ({ inv, source, context }) =>
        inv.assets.includes(source) && !context.peril && !context.weakness && !context.cannotCancel],
      resolve: ({ inv, source, context, api }) => {
        if (api.moveCard({ id: source.id, from: 'play', to: 'removedFromGame', ownerSeat: inv.seat }) === code) {
          api.setReactionFlag('cancelled', true, context)
        }
      },
    },
  ],
}
