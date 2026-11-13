// 09107 猎人还是猎物（Predator or Prey）· 幸存者事件 · 0 经验 · [[抉择]]
// 卡面：每轮最多 2 张[[抉择]]。
//       显现 - 如果场上没有敌人，抽取 1 张卡牌。否则，你必须决定（选择一项）：
//         · 每个未交战的非[[精英]]敌人朝最近的调查员移动一次。
//         · 每位调查员与自己交战的所有敌人解除交战，并远离最近的敌人移动一次。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 与 09106 同一套「显现」实现：手牌来源强制能力 + cardDrawn 窗口；
//   · 敌人移动走 api.moveEnemy（会触发交战检查），调查员移动走 api.moveInvestigator，
//     解除交战走 api.disengageEnemy；最短路用地点连接表在卡内 BFS（只读 state.locations）。
// approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似；平局的最短/最远分支按地点 id 排序取第一个。
const code = '09107'

const adjacency = state => {
  const graph = new Map()
  for (const location of state.locations || []) {
    if (!graph.has(location.id)) graph.set(location.id, new Set())
    for (const next of location.connections || []) {
      graph.get(location.id).add(next)
      if (!graph.has(next)) graph.set(next, new Set())
      graph.get(next).add(location.id)
    }
  }
  return graph
}

const distancesFrom = (state, sources) => {
  const graph = adjacency(state)
  const distance = new Map()
  const queue = []
  for (const id of sources) if (graph.has(id) && !distance.has(id)) { distance.set(id, 0); queue.push(id) }
  while (queue.length) {
    const id = queue.shift()
    for (const next of graph.get(id) || []) {
      if (distance.has(next)) continue
      distance.set(next, distance.get(id) + 1)
      queue.push(next)
    }
  }
  return distance
}

// 从 fromId 走一步：min 表示靠近目标、max 表示远离目标。
const stepFrom = (state, fromId, goals, mode) => {
  const graph = adjacency(state)
  const distance = distancesFrom(state, goals)
  const here = distance.get(fromId)
  if (here == null) return null
  const options = [...(graph.get(fromId) || [])].filter(id => distance.has(id))
    .filter(id => (mode === 'min' ? distance.get(id) < here : distance.get(id) > here))
    .sort()
  if (!options.length) return null
  return mode === 'min'
    ? options.sort((a, b) => distance.get(a) - distance.get(b))[0]
    : options.sort((a, b) => distance.get(b) - distance.get(a))[0]
}

const reveal = ({ state, inv, api }) => {
  const enemies = (state.enemies || []).filter(enemy => !enemy.defeated)
  if (!enemies.length) {
    api.drawCardsLogged(inv.seat, 1)
    api.info('🃏 「猎人还是猎物」：场上没有敌人，抽 1 张牌。')
    api.discardFromHand(inv.seat, code)
    return
  }
  const unengaged = enemies.filter(enemy => !enemy.elite && enemy.engagedSeat == null && enemy.location)
  const alive = state.investigators.filter(owner => !owner.defeated && !owner.resigned)
  const options = []
  if (unengaged.length && alive.length) options.push({ id: 'prey', label: '每个未交战的非精英敌人朝最近的调查员移动一次' })
  if (alive.some(owner => owner.engaged?.length || (enemies.some(enemy => enemy.engagedSeat === owner.seat)))) {
    options.push({ id: 'predator', label: '每位调查员解除交战并远离最近的敌人移动一次' })
  }
  if (!options.length) options.push({ id: 'prey', label: '没有可移动的敌人或调查员' })
  const choice = options.length === 1 ? options[0].id : api.choice({
    kind: 'effect', source: code, seat: inv.seat, prompt: '「猎人还是猎物」：选择一项。', options,
  })
  if (choice === 'prey') {
    const investigatorLocations = alive.map(owner => owner.location).filter(Boolean)
    for (const enemy of unengaged) {
      const next = stepFrom(state, enemy.location, investigatorLocations, 'min')
      if (next) api.moveEnemy(enemy, next)
    }
    api.info('🐾 「猎人还是猎物」：未交战的非精英敌人朝最近的调查员各移动一次。')
  } else {
    const enemyLocations = enemies.map(enemy => enemy.location).filter(Boolean)
    for (const owner of alive) {
      for (const enemy of enemies.filter(item => item.engagedSeat === owner.seat)) api.disengageEnemy(enemy)
      if (!owner.location) continue
      const next = stepFrom(state, owner.location, enemyLocations, 'max')
      if (next) api.moveInvestigator(owner.seat, next)
    }
    api.info('🏃 「猎人还是猎物」：调查员们解除交战并远离最近的敌人各移动一次。')
  }
  api.discardFromHand(inv.seat, code)
}

export default {
  code,
  note: 'approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似（缺特质作用域上限）；平局按地点 id 排序。',
  playCondition: [{ when: () => false, message: '「猎人还是猎物」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'investigator', count: 2 },
      label: '显现：没有敌人则抽 1 张，否则二选一移动',
      criteria: [({ inv, context }) => context?.cardCode === code && (inv.hand || []).includes(code)],
      resolve: reveal,
    },
  ],
  modifiers: [],
}
