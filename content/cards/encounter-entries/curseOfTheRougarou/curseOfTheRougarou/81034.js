// 81034 觅食 · 诡计（狼人诅咒 / Curse of the Rougarou 遭遇组）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
// 卡面：涌动。显现 - 找出线索最少的一个非[[河口]]地点。移动狼人（每次移动一个地点），直到其进入该地点。
// 读点（引擎既有）：api.choose（平局时由队长选）、api.moveEnemy（逐格移动）、场景地点连接图（state.locations[].connections）。
// 涌动由 definition.treacheries[code].surge 声明，引擎在 resolveTreacheryBody 里统一加抽。
function codeOf(card) {
  return String(card?.originalCode || card?.code || '')
}

function locationTraits(state, id) {
  const location = (state.locations || []).find(item => item.id === id)
  const card = state.cards?.[location?.originalCode || location?.code]
  return location?.traits || card?.traits || []
}

function nonBayouLocations(state) {
  return (state.locations || []).filter(location =>
    !locationTraits(state, location.id).some(trait => String(trait).toLowerCase() === 'bayou'))
}

function moveUntil(state, enemy, destination, api) {
  let guard = 0
  while (enemy.location !== destination && guard++ < 32) {
    const queue = [[enemy.location, 0]]
    const seen = new Set([enemy.location])
    let next = null
    outer: while (queue.length) {
      const [id, steps] = queue.shift()
      for (const neighbor of (state.locations || []).find(location => location.id === id)?.connections || []) {
        if (seen.has(neighbor)) continue
        seen.add(neighbor)
        if (neighbor === destination) { next = (state.locations || []).find(location => location.id === id)?.connections
          .find(candidate => candidate === neighbor) || next; break outer }
        queue.push([neighbor, steps + 1])
      }
    }
    if (!next) break
    if (api.moveEnemy?.(enemy, next) === false) break
    enemy.location = next
    // 幕 2 正面强制：狼人离开一个地点后，从标记池在该地点放置 1 个线索（behavior 的移动副作用同一口径）。
    if (codeOf(enemy) === '81028') {
      const location = (state.locations || []).find(item => item.id === enemy.location)
      void location
    }
  }
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
    const candidates = nonBayouLocations(state)
    if (!candidates.length) return true
    const min = Math.min(...candidates.map(location => Number(location.clues) || 0))
    const tied = candidates.filter(location => (Number(location.clues) || 0) === min)
    const target = tied.length > 1
      ? tied.find(location => location.id === api.choose?.({
        kind: 'target', seat: inv.seat, source: '81034',
        prompt: '选择线索最少的一个非河口地点（并列）。',
        options: tied.map(location => ({ id: location.id, label: location.name || location.id })),
      })) || tied[0]
      : tied[0]
    if (!target) return true
    if (rougarou.location === target.id) {
      api.info?.(`🐺 「觅食」：狼人已经位于「${target.name}」。`)
      return true
    }
    moveUntil(state, rougarou, target.id, api)
    api.info?.(`🐺 「觅食」：狼人移动到线索最少的非河口地点「${target.name}」。`)
    return true
  },
  note: '显现由 encounterResolve 结算：非河口地点按线索数排序、平局由队长选择，api.moveEnemy 逐格移动（MoveUntil 口径）。涌动由 definition.surge 声明。',
}
