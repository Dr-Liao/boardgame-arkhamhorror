// 08084 追踪（1 级）
// 卡面：选择你所在地点以外任意地点的一个敌人。沿着最短路径，朝着该敌人移动2次，
//       或在你与选定敌人间最短路径上的任意无人地点发现1个线索。
//
// 读点：地图连接由 state.locations[].connections 只读计算（BFS）；移动走 api.moveInvestigator，
// 线索走 api.discoverClue(seat,1,locationId)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

const pathTo = (state, from, to) => {
  if (!from || !to) return []
  const queue = [[from]]
  const seen = new Set([from])
  while (queue.length) {
    const path = queue.shift()
    const current = path.at(-1)
    if (current === to) return path
    const location = state.locations.find(item => item.id === current)
    for (const next of location?.connections || []) {
      if (seen.has(next) || !state.locations.some(item => item.id === next)) continue
      seen.add(next)
      queue.push([...path, next])
    }
  }
  return []
}

export default {
  code: '08084',
  abilities: [
    { kind: 'played', label: '追踪：朝目标敌人移动 2 次，或在最短路径的无人地点发现线索',
      resolve: ({ inv, state, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location &&
          enemy.location !== inv.location && !enemy.defeated && !enemy.elite)
        if (!targets.length) { api.info('没有可选的其他地点敌人。'); return }
        const targetId = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '08084', seat: inv.seat,
          prompt: '选择要追踪的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = targets.find(enemy => enemy.id === targetId) || targets[0]
        const path = pathTo(state, inv.location, target.location)
        if (path.length < 2) { api.info('没有通往该敌人所在地点的路径。'); return }
        const mode = api.choice({ kind: 'effect', source: '08084', seat: inv.seat,
          prompt: '选择追踪方式。', options: [
            { id: 'move', label: '沿最短路径朝该敌人移动 2 次' },
            { id: 'clue', label: '在最短路径的无人地点发现 1 个线索' },
          ] })
        if (mode === 'move') {
          for (const destination of path.slice(1, 3)) {
            if (!api.canMoveTo(inv.seat, destination)) break
            api.moveInvestigator(inv.seat, destination)
          }
          return
        }
        const candidates = path.slice(1, -1).filter(id => !state.investigators.some(other => other.location === id)
          && !state.enemies.some(enemy => enemy.location === id))
        if (!candidates.length) { api.info('最短路径上没有无人地点。'); return }
        const where = candidates.length === 1 ? candidates[0] : api.choice({ kind: 'location', source: '08084', seat: inv.seat,
          prompt: '选择要发现线索的无人地点。', options: candidates.map(id => ({ id, label: api.locName(id) })) })
        api.discoverClue(inv.seat, 1, where)
      } },
  ],
  modifiers: [],
}
