// 06123 奥瑞巴岛（theSearchForKadath）· 幕 2a（区域：奥瑞巴）
// 卡面：目标 - 在这个区域发现尽可能多的神迹。当一轮结束时，如果每位调查员都位于同一个[[港口]]地点，
//       你可以通过推进本幕移动到另一个区域。目标 - 如果调查员发现了10个神迹，进入（→结局1）。
// 卡面（背面「去哪里？」）：将遭遇弃牌堆洗入遭遇牌库。调查员必须决定（选择一项），
//       不能选择已经造访过的地点；如果列出的区域都已造访，进入（→结局1）：
//       西方米纳尔古地 / 北方禁闭之地 / 东方永恒之国的王国。
//
// 一卡一文件：区域选择写入 scenarioFlags.pendingRegion，区域设置由章节 behavior 结算。
const REGIONS = [
  { id: 'mnar', label: '西方的米纳尔古地' },
  { id: 'forbiddenLands', label: '北方的禁闭之地' },
  { id: 'timelessRealm', label: '东方的永恒之国' },
]

export default {
  code: '06123', scope: 'act', implemented: true,
  actRule: {
    regionOptions: REGIONS.map(region => region.id),
    onReveal(state, act, api) {
      api.shuffleDiscard?.()
      api.info?.('🚢 「去哪里？」：遭遇弃牌堆洗入遭遇牌库。')
      const visited = state.scenarioFlags?.regionsVisited || []
      const available = REGIONS.filter(region => !visited.includes(region.id))
      if (!available.length) {
        api.info?.('🚢 所有区域都已造访：进入结局 1。')
        api.finish?.('resolution1')
        return true
      }
      const answer = api.choose?.({
        kind: 'story', source: '06123', seat: Number(state.campaign?.leadSeat ?? 0),
        prompt: '「去哪里？」：选择下一个要前往的区域（不能是已造访区域）。',
        options: available.map(region => ({ id: region.id, label: region.label })),
      }) ?? available[0].id
      api.setScenarioFlag?.('pendingRegion', String(answer))
      api.info?.(`🧭 调查员决定前往：${available.find(region => region.id === String(answer))?.label || answer}。`)
      return true
    },
  },
}
