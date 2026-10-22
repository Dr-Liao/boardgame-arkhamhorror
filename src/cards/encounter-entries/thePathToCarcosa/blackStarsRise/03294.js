// 03294 回廊
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：[action]如果回廊没有线索：谈判。检定[willpower](3)。如果你检定成功，记住你“找到了一个向导”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 98 轮：黑星升起的回廊 / 骑士大厅。

export default {
  code: '03294', scope: 'location',
  locationRule: {
    actions({ state, location, moves }) {
      if (state.scenarioFlags.foundGuide) return
      moves.push({ action: 'scenarioAction', actionKind: 'parley', rule: 'findGuide',
        label: '谈判：检定意志（3），寻找向导',
        reason: location.clues === 0 ? null : `需要先取走回廊的全部线索（还剩 ${location.clues} 个）` })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'findGuide') return false
      const location = state.locations.find(item => item.id === inv.location)
      if (!location || location.clues > 0 || state.scenarioFlags.foundGuide) {
        throw new Error('回廊能力当前不可用')
      }
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) state.scenarioFlags.foundGuide = true
      })
      return true
    },
  },
}
