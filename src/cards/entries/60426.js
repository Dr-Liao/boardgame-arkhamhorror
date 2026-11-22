import { firstMatchingToken } from './_shared.js'

export default {
  code: '60426',
  uses: 3,
  usesType: 'charges',
  abilities: [{
    kind: 'action',
    countsAs: 'investigate',
    label: '花费 1 充能：用意志调查，意志 +2，线索 +1；揭示旧印、+1 或 0 时恐惧 1',
    cost: { action: true, uses: 1 },
    criteria: ({ helpers }) => !helpers.capabilityBlocked('investigate'),
    resolve: ({ inv, api, source }) => api.investigate(inv.seat, {
      assetId: source.id,
      skill: 'willpower',
      bonus: 2,
      clueBonus: 1,
      onToken: firstMatchingToken(['eldersign', '+1', '0'], { api, inv, source }, () => api.horror(inv.seat, 1)),
    }),
  }],
}
