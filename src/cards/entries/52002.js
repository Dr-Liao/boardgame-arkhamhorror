import { ALL_CARDS } from '../cards-data.js'
import { ownSeat } from '../../engine/matcher.js'

const firingAsset = (inv, id) => inv.assets.find(asset => asset.id === id
  && asset.usesType === 'ammo' && asset.uses > 0
  && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'firearm'))

export default {
  code: '52002',
  abilities: [{
    kind: 'played',
    fast: true,
    trigger: 'activateFirearmFight',
    label: '额外消耗 1 发弹药，额外揭示 1 枚标记',
    criteria: [ownSeat(), ({ inv, context }) => Boolean(firingAsset(inv, context?.assetId))],
    resolve: ({ inv, context, api }) => {
      const asset = firingAsset(inv, context.assetId)
      if (asset && api.spendUses(asset, 1)) api.addExtraChaosChoicesToTest(1)
    },
  }],
}
