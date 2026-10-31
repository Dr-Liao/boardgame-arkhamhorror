// 06122 斯凯王国（theSearchForKadath）· 幕 1（团队 2×人数线索，港口，轮末）
// 卡面：目标 - 当一轮结束时，位于[[港口]]地点的调查员可以共同花费所需数量的线索以推进。
// 卡面（背面「出海！」）：检索遭遇牌库、遭遇弃牌堆与所有场上区域，找出「乌撒之猫」、每张
//       「一群乌尼斯」、以及「祖格鼠」遭遇组的所有卡牌，移出游戏。
//       将每张放在一边的「千面祭司」连同遭遇弃牌堆一起洗入遭遇牌库。
//       调查员必须决定（选择一项）：南方奥瑞巴岛 / 西方米纳尔古地 / 北方禁闭之地 / 东方永恒之国的王国。
//
// 一卡一文件：objective 在 definition（ACT_EXTRA），本条目只管背面：移出指定卡、洗回祭司、
// 选择下一个区域（写入 scenarioFlags.pendingRegion，区域设置由章节 behavior 结算）。
const REMOVE_FROM_GAME = ['06145', '06151', '06106', '06107', '06108', '06109']
const ZOOG_SET = ['06106', '06107', '06108', '06109']
const REGIONS = [
  { id: 'oriab', label: '南方的奥瑞巴岛' },
  { id: 'mnar', label: '西方的米纳尔古地' },
  { id: 'forbiddenLands', label: '北方的禁闭之地' },
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
  code: '06122', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      for (const code of REMOVE_FROM_GAME) purgeEncounterCode(state, api, code)
      api.info?.(`⚓ 「出海！」：乌撒之猫、一群乌尼斯与祖格鼠遭遇组的 ${REMOVE_FROM_GAME.length} 个卡号被移出游戏。`)
      let priests = 0
      for (let index = 0; index < 3; index += 1) {
        if (!api.takeFromSetAside?.('06149')) break
        priests += 1
      }
      if (priests) api.shuffleIntoEncounterDeck?.(Array(priests).fill('06149'), { shuffle: false })
      api.shuffleDiscard?.()
      api.info?.(`⚓ 放在一边的 ${priests} 张千面祭司与遭遇弃牌堆一起洗入遭遇牌库。`)
      const visited = state.scenarioFlags?.regionsVisited || []
      const available = REGIONS.filter(region => !visited.includes(region.id))
      if (!available.length) {
        api.info?.('⚓ 所有区域都已造访：进入结局 1。')
        api.finish?.('resolution1')
        return true
      }
      const answer = api.choose?.({
        kind: 'story', source: '06122', seat: Number(state.campaign?.leadSeat ?? 0),
        prompt: '「出海！」：选择下一个要前往的区域。',
        options: available.map(region => ({ id: region.id, label: region.label })),
      }) ?? available[0].id
      api.setScenarioFlag?.('pendingRegion', String(answer))
      api.info?.(`🧭 调查员决定前往：${available.find(region => region.id === String(answer))?.label || answer}。`)
      return true
    },
  },
}
