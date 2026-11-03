import { keysAt } from '../../_shared.js'

export default {
  code: '07174b',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.placeRandom(`location:${location.id}`)
    },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '控制黑色钥匙：获得5资源（团队每场一次）',
    cost: { action: 1 },
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, inv, helpers }) => keysAt(state, `investigator:${inv.seat}`).includes('black')
      && helpers.canGainResources(),
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 5),
  }],
}
