// 04345 再次进入遗迹
// 归属：关卡专用 · turnBackTime（失落的时代 · 时间倒流）
// 遭遇组：turn_back_time
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04345', scope: 'act',
  actRule: {
    onReveal(state, act, api, hooks) {
      // 背面：把放在一边的时间石室洗入探索牌库；本场景进胜利区并获得复仇 2。
      hooks.removeSetAsideLocation('chamberOfTime')
      if (api.addToExplorationDeck) api.addToExplorationDeck(['chamberOfTime'])
      else {
        state.explorationDeck = [...(state.explorationDeck || []), 'chamberOfTime']
        hooks.shuffleDeck()
      }
      state.scenarioFlags ||= {}
      state.scenarioFlags.chamberOfTimeInDeck = true
      hooks.addActToVictory(act)
      api.info?.('🧭 时间石室被洗入探索牌库。')
    },
  },
}
