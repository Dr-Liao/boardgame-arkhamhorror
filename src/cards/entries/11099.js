import { ALL_CARDS } from '../cards-data.js'
import { ownSeat, ownTurn } from '../../engine/matcher.js'

const code = '11099'
const isTomeAsset = card => card?.type === 'asset' && card.traits?.some(trait => trait.toLowerCase() === 'tome')
const attached = (inv, host) => inv.assets.find(asset => asset.attachedToAsset === host?.id)

export default {
  code,
  attachedAssetsIgnoreSlots: ['hand', 'arcane', 'body', 'accessory', 'ally', 'tarot'],
  abilities: [
    {
      kind: 'free', cost: { resources: 1 }, label: '花 1 资源：附属一张手牌中的书籍支援，使其不占用槽位',
      criteria: [ownTurn(), ({ inv, source }) => !attached(inv, source)],
      target: { kind: 'cardInHand', query: ({ entity }) => isTomeAsset(ALL_CARDS[entity.code]) },
      resolve: ({ inv, source, targetId, api }) => api.putHandAssetOnHost(inv.seat, targetId, source),
    },
    {
      kind: 'forced', trigger: 'turnEnded', label: '你的回合结束时，将附属支援放到你的牌库底',
      criteria: [ownSeat(), ({ inv, source }) => Boolean(attached(inv, source))],
      resolve: ({ inv, source, api }) => {
        const asset = attached(inv, source)
        if (asset) api.moveCard({ id: asset.id, from: 'play', to: 'deckBottom', ownerSeat: inv.seat })
      },
    },
  ],
}
