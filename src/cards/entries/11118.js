import { ALL_CARDS } from '../cards-data.js'
import { hasTrait } from '../../engine/matcher.js'
import { cannotLeaveHand } from '../../engine/ability.js'

const code = '11118'
const attachedTo = (inv, source) => inv.assets.find(asset => asset.attachedToAsset === source.id)
const isEligibleTome = cardCode => ALL_CARDS[cardCode]?.type === 'asset' && hasTrait(ALL_CARDS[cardCode], 'Tome')
  && !cannotLeaveHand(cardCode)

export default {
  code,
  attachedAssetsIgnoreSlots: ['hand', 'ally', 'arcane', 'accessory', 'body', 'tarot'],
  abilities: [{
    kind: 'free',
    cost: { exhaust: true },
    label: '你的回合：横置，将手牌中一张书籍支援附属至借书证',
    criteria: ({ inv, source, state }) => state.phase === 'investigation' && state.currentSeat === inv.seat
      && !inv.turnEnded && !attachedTo(inv, source) && inv.hand.some(isEligibleTome),
    target: { kind: 'cardInHand', query: ({ entity }) => isEligibleTome(entity.code) },
    resolve: ({ inv, source, target, api }) => {
      api.putIntoPlay(inv.seat, target.entity.code, { attachToAssetId: source.id })
    },
  }, {
    kind: 'forced', trigger: 'turnEnded',
    label: '你的回合结束时：支付 1 资源，或将附属支援置于牌库底',
    criteria: ({ inv, source, context, helpers }) => context.seat === inv.seat
      && (Boolean(attachedTo(inv, source)) || helpers.availableResources() > 0),
    resolve: ({ inv, source, api }) => {
      const tome = attachedTo(inv, source)
      const options = []
      if (api.availableResources(inv) > 0) options.push({ id: 'pay', label: '支付 1 资源' })
      if (tome) options.push({ id: 'bottom', label: '将附属书籍放在牌库底' })
      const answer = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: code, seat: inv.seat, prompt: '选择借书证的回合结束费用。', options,
      })
      if (answer === 'pay') api.spendResources(inv.seat, 1)
      else api.moveCard({ id: tome.id, from: 'play', to: 'deckBottom' }, { seat: inv.seat })
    },
  }],
}
