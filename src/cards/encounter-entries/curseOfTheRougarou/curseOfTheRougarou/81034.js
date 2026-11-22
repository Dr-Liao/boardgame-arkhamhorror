// 81034 觅食 · 诡计（狼人诅咒 / Curse of the Rougarou 遭遇组）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
// 卡面：涌动。显现 - 找出线索最少的一个非[[河口]]地点。移动狼人（每次移动一个地点），直到其进入该地点。
// 读点（引擎既有）：api.choose（平局时由队长选）、api.moveEnemy（逐格移动）、state 只读地点连接图。
// 涌动由 definition.treacheries[code].surge 声明，引擎在 resolveTreacheryBody 里统一加抽。
function codeOf(card) {
  return String(card?.originalCode || card?.code || '')
}

const locationByState = (state, id) => (state.locations || []).find(location => location.id === id) || null

const traitsOf = (state, location) => location?.traits
  || state.cards?.[location?.originalCode || location?.code]?.traits || []

const isBayou = (state, location) =>
  traitsOf(state, location).some(trait => String(trait).toLowerCase() === 'bayou')

/** 到目标地点的下一步（沿连接图 BFS，取最短路的第一格）；只读。 */
function nextStepToward(state, from, destination) {
  if (!from || from === destination) return null
  const previous = new Map([[from, null]])
  const queue = [from]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    for (const neighbor of locationByState(state, current)?.connections || []) {
      if (previous.has(neighbor)) continue
      previous.set(neighbor, current)
      if (neighbor !== destination) { queue.push(neighbor); continue }
      let step = destination
      while (previous.get(step) && previous.get(step) !== from) step = previous.get(step)
      return step
    }
  }
  return null
}

export default {
  code: '81034',
  scope: 'treachery',
  implemented: true,
  flags: { surge: true },
  encounterResolve(state, inv, card, api) {
    const rougarou = (state.enemies || []).find(enemy => codeOf(enemy) === '81028' && !enemy.defeated)
    if (!rougarou) {
      api.info?.('🐺 「觅食」：狼人不在场，无事发生。')
      return true
    }
    const candidates = (state.locations || []).filter(location => !isBayou(state, location))
    if (!candidates.length) return true
    const min = Math.min(...candidates.map(location => Number(location.clues) || 0))
    const tied = candidates.filter(location => (Number(location.clues) || 0) === min)
    const chosenId = tied.length > 1
      ? api.choose?.({
        kind: 'target', seat: inv.seat, source: '81034',
        prompt: '选择线索最少的一个非河口地点（并列）。',
        options: tied.map(location => ({ id: location.id, label: location.name || location.id })),
      })
      : tied[0].id
    const target = tied.find(location => location.id === chosenId) || tied[0]
    if (!target) return true
    if (rougarou.location === target.id) {
      api.info?.(`🐺 「觅食」：狼人已经位于「${target.name}」。`)
      return true
    }
    let guard = 0
    while (rougarou.location !== target.id && guard++ < 32) {
      const step = nextStepToward(state, rougarou.location, target.id)
      if (!step) break
      if (api.moveEnemy?.(rougarou, step) === false) break
    }
    api.info?.(`🐺 「觅食」：狼人移动到线索最少的非河口地点「${target.name}」。`)
    return true
  },
  note: '显现由 encounterResolve 结算：非河口地点按线索数排序、平局由队长选择，api.moveEnemy 逐格移动（MoveUntil 口径）；只读状态，写入全部走 api。涌动由 definition.surge 声明。',
}
