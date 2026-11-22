import { ALL_CARDS } from '../cards-data.js'

const code = '90024'
const directive = asset => !asset.facedown && ALL_CARDS[asset.code]?.name === 'Directive'
const directiveLabel = (api, cardCode) => {
  const card = ALL_CARDS[cardCode]
  return `${api.cardName(cardCode)} · ${card.subnameZh || card.subname}`
}

export default {
  code,
  kind: 'investigator',
  investigator: { trackClueDiscovery: true },
  elderSign: {
    resolve: ({ inv, api }) => {
      const candidates = inv.assets.filter(directive)
      if (candidates.length) {
        const selected = api.choice({ kind: 'target', source: code, seat: inv.seat, canSkip: true,
          prompt: '本轮忽略哪张指令的约束？', options: [
            { id: 'skip', label: '跳过' },
            ...candidates.map(asset => ({ id: asset.id, cardCode: asset.code, label: directiveLabel(api, asset.code) })),
          ] })
        const asset = candidates.find(candidate => candidate.id === selected)
        if (asset) api.ignoreAssetRegulation(inv.seat, asset)
      }
      return { delta: 2 }
    },
  },
  abilities: [{
    kind: 'free', limit: { scope: 'perGame', owner: 'investigator' }, label: '将一张指令永久支援翻面',
    target: { kind: 'asset', query: ({ inv, entity }) => inv.assets.includes(entity) && directive(entity) },
    resolve: ({ inv, target, api }) => api.turnAssetFacedown(inv.seat, target.entity),
  }],
}
