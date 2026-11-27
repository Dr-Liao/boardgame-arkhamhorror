// 09642 证券交易所 · 地点（dogsOfWar）
// 印刷数据由章节 definition 的 location() 从卡表读取；地点能力由章节 behavior 承接。

export default {
  code: '09642',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 2, printedClues: 2, },
  locationRule: {
    enemiesCannotEnter: (state, location) => {
      if (!location.revealed) return false
      const loci = [...(state.enemies || []), ...(state.storyAssets || []), ...state.locations]
        .filter(card => card.keyLocus === true && !card.defeated)
      return loci.length !== 1 || (loci[0].originalCode || loci[0].code) !== '09654b'
    },
  },
  abilities: [],
}
