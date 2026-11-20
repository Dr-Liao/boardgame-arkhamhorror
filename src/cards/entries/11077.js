import { investigatorsAt } from '../../engine/matcher.js'

const CODE = '11077'

export default {
  code: CODE,
  abilities: [{
    kind: 'commit', label: '调查成功：可为同地点调查员的支援放置至多 3 充能或秘密',
    skill: {
      maxPerTest: 1,
      onSuccessResolve: ({ state, inv, test, api }) => {
        if (test.actionKind !== 'investigate') return
        for (let point = 0; point < 3; point++) {
          const assets = investigatorsAt(state, inv.location).flatMap(other => other.assets)
            .filter(asset => ['charges', 'secrets'].includes(asset.usesType))
          if (!assets.length) break
          const selected = api.choice({
            kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要放置 1 充能或秘密的支援。',
            options: [{ id: 'done', label: '完成' }, ...assets.map(asset => ({
              id: asset.id, cardCode: asset.code, label: api.cardName(asset.code),
            }))],
          })
          if (selected === 'done') break
          api.addUses(assets.find(asset => asset.id === selected), 1)
        }
      },
    },
  }],
}
