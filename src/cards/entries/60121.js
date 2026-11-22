import { ownTurn } from '../../engine/matcher.js'

const code = '60121'

export default {
  code,
  playCondition: [ownTurn()],
  abilities: [{
    kind: 'played', fast: true, label: '重整守护者支援，获得一次仅用于攻击的额外行动',
    resolve: ({ inv, api }) => {
      const options = inv.assets.filter(asset => {
        if (!asset.exhausted) return false
        const def = api.cardDef(asset.code)
        return (def?.factions ?? [def?.klass, def?.faction2, def?.faction3]).includes('guardian')
      })
      if (options.length) {
        const id = options.length === 1 ? options[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat, prompt: '选择要重整的守护者支援。',
          options: options.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const asset = options.find(option => option.id === id)
        if (asset) api.ready(asset)
      }
      api.grantRestrictedTurnAction(inv.seat, 'fight')
    },
  }],
}
