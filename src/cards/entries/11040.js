import { investigatorsAt } from '../../engine/matcher.js'

const CODE = '11040'
const eligible = (state, inv) => investigatorsAt(state, inv.location)
  .flatMap(other => other.assets).filter(asset => ['charges', 'secrets'].includes(asset.usesType))

export default {
  code: CODE,
  abilities: [{
    kind: 'played', countsAs: 'investigate',
    label: '调查，可归袋重抽首枚标记；成功后为此地支援放置 1 充能/秘密（恰好成功 1 或 3 点则放置 2）',
    resolve: ({ state, inv, api }) => api.investigate(inv.seat, {
      rerollFirstChaosToken: true,
      sourceCode: CODE,
      onInvestigateSuccess: result => {
        const assets = eligible(state, inv)
        if (!assets.length) return
        const assetId = assets.length === 1 ? assets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要放置充能或秘密的支援。',
          options: assets.map(asset => ({
            id: asset.id, cardCode: asset.code, label: api.cardName(asset.code),
          })),
        })
        const margin = result.value - result.difficulty
        api.addUses(assets.find(asset => asset.id === assetId), margin === 1 || margin === 3 ? 2 : 1)
      },
    }),
  }],
}
