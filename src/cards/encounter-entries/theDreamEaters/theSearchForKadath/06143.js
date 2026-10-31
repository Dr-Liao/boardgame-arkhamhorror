// 06143 地图未见之城（theSearchForKadath）· 地点（城市 / 异界，掩藏，线索2，帷幕6，胜利2）
// 卡面：掩藏。
// 卡面：每有一个「千面祭司」位于地图未见之城，其隐藏值-1。
// 卡面：强制 - 在你调查地图未见之城而技能检定失败后：检索遭遇牌库与遭遇弃牌堆，
//       找出一张「千面祭司」并将其生成在此。洗回遭遇牌库。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 的 locationShroudModifier（隐藏值）与
// afterTest（失败后检索千面祭司）读取并接线；背面故事卡规则在 06143b。
export default {
  code: '06143', scope: 'location', implemented: true,
  locationRule: {
    shroudPerPriest: -1,
    afterTest(state, location, inv, result, api) {
      if (result?.success) return
      if (String(result?.source?.label || '') !== '调查') return
      const found = api.discardEncounterCard?.('06149', { includeDiscard: true }) === true
      if (found) api.takeEncounterDiscard?.('06149')
      else if (!api.takeEncounterDiscard?.('06149')) {
        api.info?.('🌌 地图未见之城：遭遇牌库与弃牌堆里没有千面祭司。')
        return
      }
      api.spawn?.('06149', location.id)
      api.shuffleEncounterDeck?.()
      api.info?.('🌌 地图未见之城：一名千面祭司从遭遇牌堆/弃牌堆生成在此。')
    },
  },
}
