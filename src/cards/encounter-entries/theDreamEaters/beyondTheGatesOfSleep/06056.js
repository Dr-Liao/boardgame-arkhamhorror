// 06056 魔幻森林·迷失森林（Enchanted Woods · Lost Woods）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 你揭示本地地点后：若你没在本轮结束前离开本地点，在当前议程上放置 1 个毁灭。
// 读点：locationRule.onReveal（引擎直接读，第 4 参 seat = 揭示者）；
//   标记写入 api.setScenarioFlag('lostWoodsPending', [...])，章节 behavior.roundEnded 结算
//   （「是否离开」由 behavior.locationLeft 清除对应记录）。
const CODE = '06056'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, location, api, seat) {
      if (seat == null) return true
      const pending = Array.isArray(state.scenarioFlags?.lostWoodsPending)
        ? [...state.scenarioFlags.lostWoodsPending] : []
      pending.push({ seat: Number(seat), locationId: location.id, round: Number(state.round) || 0 })
      api.setScenarioFlag?.('lostWoodsPending', pending)
      api.info?.(`🌲 「迷失森林」：${state.investigators?.[seat]?.name || '调查员'} 若本轮结束前不离开，将在议程上放置 1 个毁灭。`)
      return true
    },
  },
}
