// 03101 淤泥与污物
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：decay
// 卡面：显现 - 将淤泥与污物放置入场，放在密谋牌库旁。
// 卡面：每个地点的隐藏值+1。
// 卡面：强制 - 当一轮结束时：弃掉淤泥与污物。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03101', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    state.fogMod = (state.fogMod || 0) + 1
    state.scenarioFlags ||= {}
    state.scenarioFlags.decayRound = state.round
    return true
  },
}
