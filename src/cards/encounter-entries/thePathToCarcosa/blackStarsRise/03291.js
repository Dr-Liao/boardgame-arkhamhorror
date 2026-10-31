// 03291 修道院教堂
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 正面：如果场上有2张密谋编号不同的密谋，修道院教堂的隐藏值+2。
// 正面：强制 - 在修道院教堂揭示时：将放在一边的哥特式唱诗台、骑士大厅、回廊、圣奥伯特礼拜堂和修道院塔楼地点放置入场。
// 背面：进入的额外费用由垮塌的台阶上的调查员共同支付 3×人数线索。揭示后失效。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03291', scope: 'location', implemented: true, flags: { abbeyChurch: true },
  locationRule: {
    entryError(state, location) {
      const cost = 3 * state.numInvestigators
      const stairs = state.locations.find(item => item.id === 'brokenSteps')
      const pool = stairs ? state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === stairs.id)
        .reduce((sum, inv) => sum + (inv.clues || 0), 0) : 0
      if (pool < cost) return `进入修道院教堂需要在垮塌的台阶共同支付 ${cost} 个线索`
      return null
    },
    beforeEnter(state, location, _inv, api) {
      api.payClues(3 * state.numInvestigators, 'brokenSteps')
    },
    onReveal(state, location, api) {
      for (const id of ['choeurGothique', 'knightsHall', 'cloister', 'chapelOfStAubert', 'abbeyTower']) api.place(id)
    },
  },
}
