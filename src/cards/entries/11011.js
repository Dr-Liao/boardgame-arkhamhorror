import { ownSeat } from '../../engine/matcher.js'

import { ALL_CARDS } from '../cards-data.js'

const firearm = asset => ALL_CARDS[asset?.code]?.traits?.some(trait => trait.toLowerCase() === 'firearm')

export default {
  code: '11011',
  investigator: { elderSign: { bonus: 2 } },
  elderSign: { id: '11011-sign', resolve: ({ inv, api }) => {
    const assets = inv.assets.filter(firearm)
    if (assets.length) {
      const chosen = api.choice({
        kind: 'asset', source: inv.code, seat: inv.seat, prompt: '可为一个枪械支援增加 1 弹药。',
        options: [{ id: 'skip', label: '跳过' }, ...assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) }))],
      })
      const asset = assets.find(item => item.id === chosen)
      if (asset) api.addAmmo(asset)
    }
    return { delta: 2 }
  } },
  abilities: [{
    kind: 'reaction', trigger: 'ammoSpent', label: '花费枪械弹药后获得 1 资源',
    limit: { scope: 'perRound', owner: 'contextAsset' },
    criteria: [ownSeat(), ({ context }) => firearm(context.asset)],
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
  }],
}
