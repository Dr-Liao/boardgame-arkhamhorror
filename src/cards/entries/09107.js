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
// 敌人的最近目的地和调查员要逃离的敌人出现平局时，由相应玩家选择。
const code = '09107'

const locations = state => new Map(state.locations.map(location => [location.id, location]))
function distancesFrom(graph, starts) {
  const result = new Map(starts.map(id => [id, 0]))
  const queue = [...result.keys()]
  for (const id of queue) {
    for (const next of graph.get(id)?.connections || []) {
      if (result.has(next) || !graph.has(next)) continue
      result.set(next, result.get(id) + 1)
      queue.push(next)
    }
  }
  return result
}

function chooseLocation(api, seat, prompt, options) {
  if (options.length < 2) return options[0]
  return api.choice({
    kind: 'location', source: code, seat, prompt,
    options: options.map(id => ({ id, label: api.locationName(id) })),
  })
}

function fleeOptions(graph, owner, enemies, api) {
  const fromOwner = distancesFrom(graph, [owner.location])
  const nearest = Math.min(...enemies.map(enemy => fromOwner.get(enemy.location) ?? Infinity))
  if (!Number.isFinite(nearest)) return []
  return enemies.filter(enemy => fromOwner.get(enemy.location) === nearest).flatMap(enemy => {
    const alternatives = (graph.get(owner.location)?.connections || []).filter(id => {
      const after = distancesFrom(graph, [id]).get(enemy.location) ?? Infinity
      return after > nearest && api.canMoveTo(owner.seat, id)
    })
    return alternatives.length ? [{ enemy, alternatives }] : []
  })
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
  const graph = locations(state)
  const options = []
  if (unengaged.length && alive.length) options.push({ id: 'prey', label: '每个未交战的非精英敌人朝最近的调查员移动一次' })
  if (alive.some(owner => enemies.some(enemy => enemy.engagedSeat === owner.seat)
    || fleeOptions(graph, owner, enemies, api).length)) {
    options.push({ id: 'predator', label: '每位调查员解除交战并远离最近的敌人移动一次' })
  }
  if (!options.length) options.push({ id: 'prey', label: '没有可移动的敌人或调查员' })
  const choice = options.length === 1 ? options[0].id : api.choice({
    kind: 'effect', source: code, seat: inv.seat, prompt: '「猎人还是猎物」：选择一项。', options,
  })
  if (choice === 'prey') {
    const investigatorLocations = alive.map(owner => owner.location).filter(Boolean)
    for (const enemy of unengaged) {
      const distance = id => {
        const reachable = distancesFrom(graph, [id])
        return Math.min(...investigatorLocations.map(target => reachable.get(target) ?? Infinity))
      }
      const here = distance(enemy.location)
      const steps = (graph.get(enemy.location)?.connections || []).filter(id => distance(id) < here)
      const nearest = Math.min(...steps.map(distance))
      const next = chooseLocation(api, inv.seat, `选择「${enemy.name}」靠近调查员的地点。`,
        steps.filter(id => distance(id) === nearest))
      if (next) api.moveEnemy(enemy, next)
    }
    api.info('🐾 「猎人还是猎物」：未交战的非精英敌人朝最近的调查员各移动一次。')
  } else {
    for (const owner of alive) {
      const engaged = enemies.filter(enemy => enemy.engagedSeat === owner.seat)
      for (const enemy of engaged) api.disengageEnemy(enemy)
      const options = fleeOptions(graph, owner, enemies, api)
      const picked = options.length < 2 ? options[0]?.enemy.id : api.choice({
        kind: 'enemy', source: code, seat: owner.seat,
        prompt: '选择要远离的最近敌人。',
        options: options.map(({ enemy }) => ({ id: enemy.id, label: enemy.name })),
      })
      const choice = options.find(option => option.enemy.id === picked)
      const next = choice && chooseLocation(api, owner.seat, '选择远离这名敌人的地点。', choice.alternatives)
      if (next) api.moveInvestigator(owner.seat, next)
      if (!next || owner.location !== next) {
        for (const enemy of engaged) if (enemy.engagedSeat == null && !enemy.exhausted) api.engage(enemy, owner.seat)
      }
    }
    api.info('🏃 「猎人还是猎物」：调查员们解除交战并远离最近的敌人各移动一次。')
  }
  api.discardFromHand(inv.seat, code)
}

export default {
  code,
  playCondition: [{ when: () => false, message: '「猎人还是猎物」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'group', count: 2, sharedKey: 'dilemma' },
      label: '显现：没有敌人则抽 1 张，否则二选一移动',
      criteria: [({ inv, context }) => context?.cardCode === code && context.seat === inv.seat && (inv.hand || []).includes(code)],
      resolve: reveal,
    },
  ],
  modifiers: [],
}
