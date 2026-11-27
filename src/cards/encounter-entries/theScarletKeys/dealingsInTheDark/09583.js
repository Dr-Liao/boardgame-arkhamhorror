// 09583 大巴扎 · 地点（dealingsInTheDark）
// 珠宝匠之路：调查成功时，可用超出难度的点数为打出的守护或遗物支援减费。
export default {
  code: '09583',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 3, printedClues: 2 },
  abilities: [{
    kind: 'action', actionKind: 'investigate', range: 'here',
    label: '调查：成功后可改为打出一张[[守护]]或[[遗物]]支援，每超过难度 1 点费用 -1',
    criteria: ({ inv, source }) => source.revealed && inv.location === source.id,
    resolve: ({ inv, source, api }) => api.investigate(inv.seat, {
      locationId: source.id,
      onInvestigateSuccess(_result, { successBy }) {
        const discount = Math.max(0, successBy)
        const assets = [...new Set(['Charm', 'Relic'].flatMap(trait =>
          api.playHandCardOptions(inv.seat, { type: 'asset', trait, discount })))]
        if (!assets.length) return false
        const code = api.choose({
          kind: 'card', source: '09583', seat: inv.seat, canSkip: true,
          prompt: `珠宝匠之路：发现线索，或减免 ${discount} 个资源打出一张支援。`,
          options: [{ id: 'skip', label: '如常发现线索' },
            ...assets.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))],
        })
        return assets.includes(code) && Boolean(api.playAsEffect(inv.seat, code, { discount }))
      },
    }),
  }],
}
