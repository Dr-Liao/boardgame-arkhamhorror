// 11672a · storyAsset · obsidianCanyons
//
// 黑曜石之爪（速度面，放一边入场；不能离场）。
// [fast] 横置并选至多 2 次连接外一处地点移动过去；[fast] 翻面（每轮一次）。
// 受控剧情资产：controlledAsset + abilities（引擎受控资产能力枚举）；翻面走 api.flipAsset
// （physical-faces.js#applyPhysicalFace：同一实例/横置状态/控制者，只替换印刷面）。
export default {
  code: '11672a',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  cannotLeavePlay: true,
  flags: { obsidianClaw: true, face: 'speed', moveThroughSkyline: true },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '[fast] 横置黑曜石之爪：选择至多 2 次连接外的一处地点，移动到那里',
    cost: { exhaust: true },
    criteria: ({ state, inv }) => state.currentSeat === inv.seat,
    resolve: ({ state, inv, api }) => {
      const distance = new Map([[inv.location, 0]])
      const queue = [inv.location]
      while (queue.length) {
        const current = queue.shift()
        const steps = distance.get(current)
        if (steps >= 2) continue
        const location = state.locations.find(item => item.id === current)
        for (const neighbor of location?.connections || []) {
          if (distance.has(neighbor)) continue
          distance.set(neighbor, steps + 1)
          queue.push(neighbor)
        }
      }
      const candidates = [...distance.keys()].filter(id => id !== inv.location)
      if (!candidates.length) return false
      const answer = candidates.length === 1 ? candidates[0] : api.choose?.({
        kind: 'location', source: '11672a', seat: inv.seat,
        prompt: '选择至多 2 次连接外的一处地点。',
        options: candidates.map(id => ({ id, label: state.locations.find(location => location.id === id)?.name || id })),
      })
      const destination = candidates.includes(String(answer)) ? String(answer) : candidates[0]
      api.moveInvestigator(inv.seat, destination)
      api.info?.(`黑曜石之爪：${inv.name} 横置后移动到「${state.locations.find(location => location.id === destination)?.name || destination}」。`)
      return true
    },
  }, {
    kind: 'free',
    actionKind: 'activate',
    label: '[fast]：翻至黑曜石之爪（力量）面（每轮一次）',
    limit: 'oncePerRound',
    criteria: ({ inv, source }) => !source.exhausted && inv.assets.includes(source),
    resolve: ({ inv, source, api }) => {
      const asset = inv.assets.find(item => item.id === source.id)
      if (!asset) return false
      api.flipAsset(asset, '11672b')
      api.info?.('黑曜石之爪翻至（力量）面。')
      return true
    },
  }],
  note: "黑曜石之爪（速度面，放一边）。不能离场（cannotLeavePlay，引擎 assetCannotLeavePlay 读点）；[fast] 横置并选至多 2 次连接外一处地点移动过去（controlledAsset free + cost exhaust，resolve 里 BFS 连接 + api.moveInvestigator）；[fast] 翻面每轮一次（limit oncePerRound + api.flipAsset → 11672b，physical face 同一实例只换印刷面）。",
}
