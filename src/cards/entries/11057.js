import { ALL_CARDS } from '../cards-data.js'

export default {
  code: '11057', trackTestAssetSource: true,
  abilities: [
    {
      kind: 'commit', label: '仅可投入你控制的枪械或远程支援的印刷能力发起的技能检定',
      skill: {
        commitCondition: ({ owner, test }) => {
          const source = (owner.assets || []).find(asset => asset.id === (test?.assetSourceId ?? test?.source?.assetId))
          return (ALL_CARDS[source?.code]?.traits || []).some(trait => ['firearm', 'ranged'].includes(trait.toLowerCase()))
        },
      },
    },
  ],
}
