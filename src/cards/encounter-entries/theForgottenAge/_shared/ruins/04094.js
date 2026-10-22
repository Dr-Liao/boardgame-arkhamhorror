// 04094 一片漆黑
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：ruins
// 卡面：显现 - 将一片漆黑放置入场，放在密谋牌库旁。
// 卡面：每位调查员每轮不能从单个地点发现超过1个线索。
// 卡面：强制 - 当一轮结束时：从场上弃掉1张一片漆黑。(每轮最多一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04094', implemented: true, scope: 'treachery', treacheryRule: {"sideArea":true},
  encounterResolve(state, inv, card, api) {
    state.scenarioFlags ||= {}
    state.scenarioFlags.deepDark = Number(state.scenarioFlags.deepDark || 0) + 1
    state.scenarioFlags.deepDarkClaims = {}
    api.info?.('一片漆黑开始生效：每位调查员每轮从单个地点最多发现 1 个线索。')
    return true
  },
}
