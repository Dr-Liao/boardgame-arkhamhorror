// 03204 巴黎阴谋(版本一)
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：目标 - 花费所需数量的线索以推进场景。
// 卡面：目标 - 当一轮结束时，如果场上有至少3个毁灭标记，推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：卡尔科萨「真相幻影」的幕/密谋脚本。

export default {
  code: '03204', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const code = act.originalCode
      const withClues = state.scenarioFlags.actOneAdvancedWith !== 'doom'
      const convictionRoute = code === '03205'
      const leadLocation = state.investigators[state.campaign.leadSeat]?.location
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const distances = state.locations.map(location => ({
        id: location.id,
        score: Math.min(...active.map(inv => api.locationDistance(location.id, [inv.location])).filter(value => value >= 0)),
      }))
      const maximum = Math.max(...distances.map(item => item.score))
      const farthest = distances.filter(item => item.score === maximum)
      const far = farthest.length === 1 ? farthest[0].id : api.choose({
        kind: 'location', source: code, seat: state.campaign.leadSeat,
        prompt: '选择离所有调查员最远的地点生成风琴手。',
        options: farthest.map(item => ({ id: item.id, label: api.locationName(item.id) })),
      })
      if (!withClues) for (const inv of active) api.horror(inv.seat, 2)
      if ((convictionRoute && withClues) || (!convictionRoute && !withClues)) {
        api.spawn(state.scenarioFlags.organistCode, far)
      } else {
        api.spawn(state.scenarioFlags.organistCode, leadLocation)
      }
    },
  },
}
