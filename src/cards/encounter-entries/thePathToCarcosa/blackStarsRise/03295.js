// 03295 骑士大厅
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：[action]如果骑士大厅没有线索：调查。不使用[intellect]，改为使用[agility]调查。如果你检定成功，不发现线索，改为记住你“找到了塔楼的钥匙”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 这是一次调查行动，不是另挂的剧本按钮。地点上还有线索时走普通智力调查；
// 线索取完后，同一条调查改用敏捷，成功则记住钥匙。挂成 scenarioAction 时，
// 行动栏只列出 action 为 investigate 的按钮，玩家在骑士大厅会看不到这次调查。

export default {
  code: '03295', scope: 'location',
  locationRule: {
    investigateWithoutClues(state) {
      return !state.scenarioFlags?.foundTowerKey
    },
    investigateSkill(state, _inv, location) {
      if (state.scenarioFlags?.foundTowerKey || (location?.clues || 0) > 0) return null
      return 'agility'
    },
    investigateResult(state, _inv, location, result) {
      if (!result?.success || state.scenarioFlags?.foundTowerKey || (location?.clues || 0) > 0) return
      state.scenarioFlags ||= {}
      state.scenarioFlags.foundTowerKey = true
      return false
    },
  },
}
