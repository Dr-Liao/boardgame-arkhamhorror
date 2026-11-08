// 08072 沙夫纳的目录（Schoffner's Catalogue）· 幸存者资产 · 道具 · 0 经验。
//
// 卡面：使用(5 秘密)。如果沙夫纳的目录没有秘密，将其弃掉。
//       你可以将沙夫纳的目录的秘密作为资源花费，来支付你所在地点任意调查员打出的 [[道具]] 支援。
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation: 引擎没有「把支援用途当资源直接支付」的付费来源通道。这里用 free 能力
// 「花费 1 秘密 → 获得 1 资源」近似（资源可用于后续支付[[道具]]支援），并把「仅限同地点
// [[道具]]支援」的限制记在报告里。discardWhenEmpty 由条目级字段处理。
export default {
  code: '08072',
  uses: 5,
  usesType: 'secrets',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'free',
      cost: { uses: 1 },
      label: '花费 1 秘密：获得 1 资源（近似「秘密当资源支付同地点[[道具]]支援」）',
      criteria: [({ source }) => (source?.uses || 0) > 0],
      resolve: ({ inv, source, api }) => {
        if (!source) return
        api.gainResources(inv.seat, 1)
        api.info(`📒 「沙夫纳的目录」：花费 1 秘密获得 1 资源（当前秘密 ${source.uses || 0}）。`)
      },
    },
  ],
  modifiers: [],
}
