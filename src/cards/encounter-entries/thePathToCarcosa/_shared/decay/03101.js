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
    // 卡面：放置入场、每个地点 +1 帷幕；强制 - 一轮结束时弃掉本卡。
    // 因此这里返回 true（不立即进弃牌堆），轮末由章节的 roundEnded 统一撤销
    // 并按份数把卡放回遭遇弃牌堆（多张同轮入场时逐张撤销 +1）。
    state.fogMod = (state.fogMod || 0) + 1
    state.scenarioFlags ||= {}
    state.scenarioFlags.decayRound = state.round
    state.scenarioFlags.decayCount = (state.scenarioFlags.decayCount || 0) + 1
    return true
  },
}
