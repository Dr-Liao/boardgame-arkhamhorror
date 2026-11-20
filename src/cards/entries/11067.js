import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '11067',
  uses: 9,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', countsAs: 'investigate',
      label: '用意志调查；可使用充能额外揭示标记，所选与忽略同面则成功调查多发现 1 线索',
      criteria: [({ helpers }) => !helpers.capabilityBlocked('investigate')],
      resolve: ({ inv, source, api }) => api.investigate(inv.seat, {
        assetId: source.id, trackAssetSource: true, skill: 'willpower',
        clueBonusForResult: result => result.ignoredTokens?.includes(result.chosenToken) ? 1 : 0,
      }),
    },
    {
      kind: 'forced', trigger: 'beforeChaosTokenReveal', silent: true,
      label: '可花费至多 3 充能以额外揭示等量标记并选一枚结算',
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [ownSeat(), ({ state, source }) => state.skillTest?.assetSourceId === source.id],
      resolve: ({ inv, source, api }) => api.spendUsesForExtraChaos(inv.seat, source, 3),
    },
  ],
}
