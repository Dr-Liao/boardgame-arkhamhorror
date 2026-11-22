export default {
  code: '60507',
  uses: 2,
  usesType: 'keys',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    countsAs: 'investigate',
    label: '调查：本地点帷幕 -2。若成功，移除 1 钥匙',
    cost: { action: true },
    resolve: ({ api, inv, source }) => {
      const result = api.investigate(inv.seat, { assetId: source.id, shroudMod: -2 })
      if (result?.success) api.addUses(source, -1)
    },
  }],
}
