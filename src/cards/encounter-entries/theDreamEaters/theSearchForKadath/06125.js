// 06125 找寻黑夜（theSearchForKadath）· 幕 2a（区域：禁闭之地）
// 卡面：目标 - 在这个区域发现尽可能多的神迹。当一轮结束时，如果每位调查员都位于同一个[[港口]]地点，
//       你可以通过推进本幕移动到另一个区域。目标 - 如果调查员发现了10个神迹，进入（→结局1）。
// 卡面（背面「去哪里？」）：检索遭遇牌库、遭遇弃牌堆与所有场上区域，找出「夜色怪群」与
//       「跟踪的蝎狮」并移出游戏。将遭遇弃牌堆洗入遭遇牌库。
//       调查员必须决定（选择一项），不能选择已经造访过的地点：
//       南方奥瑞巴岛 / 西方米纳尔古地 / 东方永恒之国的王国。
//
// 一卡一文件：区域选择写入 scenarioFlags.pendingRegion，区域设置由章节 behavior 结算。
const REGIONS = [
  { id: 'oriab', label: '南方的奥瑞巴岛' },
  { id: 'mnar', label: '西方的米纳尔古地' },
  { id: 'timelessRealm', label: '东方的永恒之国' },
]

function purgeEncounterCode(state, api, code) {
  for (const enemy of (state.enemies || []).slice()) {
    if ((enemy.originalCode || enemy.code) === code) api.removeEnemyFromGame?.(enemy)
  }
  for (let index = 0; index < 40; index += 1) {
    if (!api.discardEncounterCard?.(code, { includeDiscard: true })) break
    api.takeEncounterDiscard?.(code)
  }
}

export default {
  code: '06125', scope: 'act', implemented: true,
  actRule: {
    regionOptions: REGIONS.map(region => region.id),
    removeFromGameCodes: ['06147', '06146'],
    onReveal(state, act, api) {
      for (const code of ['06147', '06146']) purgeEncounterCode(state, api, code)
      api.info?.('🌑 「去哪里？」：夜色怪群与跟踪的蝎狮被移出游戏。')
      api.shuffleDiscard?.()
      const visited = state.scenarioFlags?.regionsVisited || []
      const available = REGIONS.filter(region => !visited.includes(region.id))
      if (!available.length) {
        api.info?.('🌑 所有区域都已造访：进入结局 1。')
        api.finish?.('resolution1')
        return true
      }
      const answer = api.choose?.({
        kind: 'story', source: '06125', seat: Number(state.campaign?.leadSeat ?? 0),
        prompt: '「去哪里？」：选择下一个要前往的区域（不能是已造访区域）。',
        options: available.map(region => ({ id: region.id, label: region.label })),
      }) ?? available[0].id
      api.setScenarioFlag?.('pendingRegion', String(answer))
      api.info?.(`🧭 调查员决定前往：${available.find(region => region.id === String(answer))?.label || answer}。`)
      return true
    },
  },
}
