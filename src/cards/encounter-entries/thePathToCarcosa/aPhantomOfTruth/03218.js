// 03218 玛黑区
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：强制 - 你进入玛黑区后：直到本轮结束，你不能离开玛黑区。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 玛黑区（03218）：进入后到本轮结束不能离开。

export default {
  code: '03218', scope: 'location',
  locationRule: {
    exitLock: { flag: 'leMaraisLock', message: '玛黑区：本回合不能离开' },
    onEnter: {
      effect(state, location, api, inv) {
        state.scenarioFlags ||= {}
        const locks = Array.isArray(state.scenarioFlags.leMaraisLock) ? state.scenarioFlags.leMaraisLock : []
        locks.push({ seat: inv.seat, round: state.round })
        state.scenarioFlags.leMaraisLock = locks
      },
    },
  },
}
