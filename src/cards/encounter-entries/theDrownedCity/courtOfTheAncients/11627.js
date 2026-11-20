// 11627 高空栈道（冲突档案库）· 地点（你在此弃遭遇牌后，最近的一名处于重整状态的非[[精英]]敌人
//   与每位调查员解除交战，并移动到本地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：弃遭遇牌库顶窗口 encounterCardsDiscardedFromTop（engine scenario-runtime#discardEncounterTop）
//   的 forced 能力（地点实例为来源）：
//   · criteria = 决定座位位于本地点且确实弃了牌；
//   · resolve = 按地点连接 BFS 找最近的「重整 + 非精英 + 未离场」敌人，
//     先 api.scenario.disengage 解除交战，再 api.scenario.moveEnemy(..., { skipAutoEngage: true })
//     移动到本地点（印刷是「解除交战并移动」，移动后不再自动交战）。
export default {
  code: '11627',
  scope: 'location',
  implemented: true,
  note: "弃顶强制已接线（abilities: encounterCardsDiscardedFromTop，kind forced，最近重整非[[精英]]敌人解除交战并移动到本地点；移动用 skipAutoEngage 避免重新交战）。",
  abilities: [{
    kind: 'forced',
    trigger: 'encounterCardsDiscardedFromTop',
    label: '你位于高空栈道时，从遭遇牌库顶弃掉 1 张或更多卡牌后：最近的一名处于重整状态的非[[精英]]敌人与每位调查员解除交战，并移动到本地点',
    criteria: ({ inv, source, context }) => Boolean(inv) && Number(context?.count) > 0 && source?.id === inv.location,
    resolve: ({ state, inv, source, api }) => {
      const here = source?.id || inv.location
      const candidates = (state.enemies || []).filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame
        && !enemy.hostId && !enemy.enemyLocation && !enemy.exhausted
        && !(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'elite'))
      if (!candidates.length) return
      const distances = new Map([[here, 0]])
      const queue = [here]
      while (queue.length) {
        const current = queue.shift()
        const location = (state.locations || []).find(item => item.id === current)
        for (const next of [...new Set(location?.connections || [])]) {
          if (distances.has(next)) continue
          distances.set(next, distances.get(current) + 1)
          queue.push(next)
        }
      }
      const nearest = candidates
        .filter(enemy => distances.has(enemy.location))
        .sort((left, right) => distances.get(left.location) - distances.get(right.location))[0]
      if (!nearest || nearest.location === here) return
      api.scenario?.disengage?.(nearest)
      api.scenario?.moveEnemy?.(nearest, here, { skipAutoEngage: true })
      api.info?.(`高空栈道：最近的未交战非[[精英]]敌人「${nearest.name}」解除交战并移动到本地点。`)
    },
  }],
}
