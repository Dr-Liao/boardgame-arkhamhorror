// 08072 沙夫纳的目录（Schoffner's Catalogue）· 幸存者资产 · 道具 · 0 经验。
//
// 卡面：使用(5 秘密)。如果沙夫纳的目录没有秘密，将其弃掉。
//       你可以将沙夫纳的目录的秘密作为资源花费，来支付你所在地点任意调查员打出的 [[道具]] 支援。
//
export default {
  code: '08072',
  uses: 5,
  usesType: 'secrets',
  assetRule: { playCostUses: { cardType: 'asset', trait: 'Item', scope: 'location' } },
  onUsesEmptied: ({ inv, source, api }) => api.discardAsset(inv.seat, source),
}
