// 08085 追踪（3 级）
// 卡面：选择你所在地点以外任意地点的一个敌人。朝着该敌人移动2次，
//       发现你以此效果进入的每个地点的1个线索。
//
// 读点：BFS 只读连接表；移动 api.moveInvestigator，进入后 api.discoverClue(seat,1,locationId)。
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
  code: '08085',
  abilities: [
    { kind: 'played', label: '追踪：朝目标敌人移动 2 次，并在进入的每个地点发现 1 个线索',
      resolve: ({ inv, state, api }) => {
        const targets = state.enemies.filter(enemy => enemy.location &&
          enemy.location !== inv.location && !enemy.defeated && !enemy.elite)
        if (!targets.length) { api.info('没有可选的其他地点敌人。'); return }
        const targetId = targets.length === 1 ? targets[0].id : api.choice({ kind: 'target', source: '08085', seat: inv.seat,
          prompt: '选择要追踪的敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = targets.find(enemy => enemy.id === targetId) || targets[0]
        const path = pathTo(state, inv.location, target.location)
        if (path.length < 2) { api.info('没有通往该敌人所在地点的路径。'); return }
        for (const destination of path.slice(1, 3)) {
          if (!api.canMoveTo(inv.seat, destination)) break
          api.moveInvestigator(inv.seat, destination)
          api.discoverClue(inv.seat, 1, destination)
        }
      } },
  ],
  modifiers: [],
}
