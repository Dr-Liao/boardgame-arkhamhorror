import { keysAt } from '../../_shared.js'

export default {
  code: '07174a',
  scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.keys.placeRandom(`location:${location.id}`)
    },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '控制白色钥匙：抽取3张卡牌（团队每场一次）',
    cost: { action: 1 },
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state, inv, helpers }) => keysAt(state, `investigator:${inv.seat}`).includes('white')
      && helpers.canDrawCards(),
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 3),
  }],
}
