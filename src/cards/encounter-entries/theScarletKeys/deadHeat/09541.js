// 09541 哈立德（挚爱同伴）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。强制 - 哈立德入场后：将其地点的每个其他非[[精英]]敌人与平民移到连接地点（尽可能均匀地分配）。
const CODE = '09541'

function distributeKhalidArrival(state, khalid, api, moveCivilian) {
  const origin = state.locations.find(location => location.id === khalid.location)
  if (!origin) return 0
  const destinations = state.locations.filter(location => origin.connections?.includes(location.id))
  if (!destinations.length) return 0
  const seat = state.campaign?.leadSeat ?? state.currentSeat ?? 0
  const enemyItems = state.enemies.filter(enemy => enemy !== khalid && !enemy.elite && enemy.location === origin.id)
    .map(enemy => ({ id: enemy.id, label: enemy.name, enemy }))
  const civilianCount = Math.max(0, Number(origin.resources) || 0)
  const items = [...enemyItems, ...Array.from({ length: civilianCount }, (_, index) => ({
    id: `civilian:${index}`, label: '平民',
  }))]
  const movedTo = new Map(destinations.map(location => [location.id, 0]))
  let moved = 0
  while (items.length) {
    const options = items.filter(item => item.enemy).map(({ id, label }) => ({ id, label }))
    const civilian = items.find(item => !item.enemy)
    if (civilian) options.push({ id: civilian.id, label: civilian.label })
    const id = options.length === 1 ? options[0].id : api.choose({
      kind: 'choice', source: CODE, seat,
      prompt: '哈立德入场：选择接下来移动的敌人或平民。',
      options,
    })
    const index = items.findIndex(item => item.id === id)
    if (index < 0) break
    const [item] = items.splice(index, 1)
    const available = destinations.slice()
    while (available.length) {
      const fewest = Math.min(...available.map(location => movedTo.get(location.id)))
      const balanced = available.filter(location => movedTo.get(location.id) === fewest)
      const target = balanced.length === 1 ? balanced[0].id : api.choose({
        kind: 'location', source: CODE, seat,
        prompt: `选择「${item.label}」移往的连接地点。`,
        options: balanced.map(location => ({ id: location.id, label: location.name })),
      })
      const index = available.findIndex(location => location.id === target)
      if (index < 0) break
      const [location] = available.splice(index, 1)
      if (item.enemy) {
        api.moveEnemy(item.enemy, location.id)
        if (item.enemy.location !== location.id) continue
      } else moveCivilian(origin, location)
      movedTo.set(location.id, movedTo.get(location.id) + 1)
      moved++
      break
    }
  }
  return moved
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: {
    khalid: true,
    onEnterMovesNeighbors: true,
  },
  enemyRule: { onSpawnDistribute: distributeKhalidArrival },
}
