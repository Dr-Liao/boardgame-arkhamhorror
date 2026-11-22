// 60359 小道消息（The Grapevine，André Patel）
// 卡面：使用（3 流言）。如果小道消息上没有流言，将其弃掉。
//       [action] 花费 1 流言并横置小道消息：谈判。选择一个位于已揭示地点、且其地点与你的连接次数不超过 2 的敌人。
//       沿最短路径移动到该敌人所在地点（一次一个地点）并与其交战。
import { ownSeat } from '../../engine/matcher.js'

function distance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    const location = state.locations.find(candidate => candidate.id === id)
    for (const next of location?.connections || []) {
      if (next === to) return steps + 1
      if (!seen.has(next)) { seen.add(next); queue.push([next, steps + 1]) }
    }
  }
  return Infinity
}

export default {
  code: '60359',
  uses: 3,
  usesType: 'rumors',
  discardWhenEmpty: true,
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    countsAs: 'parley',
    label: '谈判：花费 1 流言，移动到 2 连接内已揭示地点的敌人处并交战',
    cost: { action: true, exhaust: true, uses: 1 },
    criteria: [ownSeat()],
    resolve: ({ state, inv, api }) => {
      const candidates = state.enemies.filter(enemy => {
        const location = state.locations.find(item => item.id === enemy.location)
        if (!location?.revealed) return false
        return distance(state, inv.location, location.id) <= 2
      })
      if (!candidates.length) {
        api.info('没有可追踪的敌人（需要已揭示地点、2 个连接以内）。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'target', source: '60359', seat: inv.seat,
        prompt: '选择要追查的敌人。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = candidates.find(item => item.id === chosen) || candidates[0]
      api.moveInvestigator(inv.seat, enemy.location)
      api.engage(enemy, inv.seat)
    },
  }],
}
