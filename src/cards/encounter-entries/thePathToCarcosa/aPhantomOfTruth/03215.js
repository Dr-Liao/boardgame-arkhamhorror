// 03215 拉雪兹神父公墓
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：强制 - 你成功调查拉雪兹神父公墓后：你不能离开拉雪兹神父公墓，直到一轮结束。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 拉雪兹神父公墓（03215）：成功调查后到本轮结束不能离开。

export default {
  code: '03215', scope: 'location',
  locationRule: {
    exitLock: { flag: 'pereLachaiseLock', message: '拉雪兹神父公墓：本回合不能离开' },
    afterTest({ state, inv, result }) {
      if (!result.success || result.source?.label !== '调查') return
      state.scenarioFlags ||= {}
      const locks = Array.isArray(state.scenarioFlags.pereLachaiseLock) ? state.scenarioFlags.pereLachaiseLock : []
      locks.push({ seat: inv.seat, round: state.round })
      state.scenarioFlags.pereLachaiseLock = locks
    },
  },
}
