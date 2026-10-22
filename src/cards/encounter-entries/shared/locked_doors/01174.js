// 01174 上锁的门
// 归属：跨战役通用
// 遭遇组：locked_doors
// 卡面：显现 - 附属到线索最多且没有附属上锁的门的地点。
// 卡面：附属的地点不能被调查。
// 卡面：[action]：检定[combat](4)以破门而入或[agility](4)以撬开门锁。如果你检定成功，弃掉上锁的门。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '01174', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    // 上锁的门：附属到线索最多且没有锁的地点；引擎已负责禁止调查与「破门」行动。
    const candidates = state.locations.filter(entry => !entry.locked)
    if (!candidates.length) { api.info?.('没有可附属上锁的门的地点。'); return false }
    const maxClues = Math.max(...candidates.map(entry => entry.clues || 0))
    const pool = candidates.filter(entry => (entry.clues || 0) === maxClues)
    const chosenId = pool.length === 1 ? pool[0].id : api.choose({
      kind: 'target', source: code, seat: inv.seat,
      prompt: '上锁的门：选择线索最多且没有锁的地点。',
      options: pool.map(entry => ({ id: entry.id, label: `${entry.name}（线索 ${entry.clues || 0}）` })),
    })
    const chosen = pool.find(entry => entry.id === chosenId) || pool[0]
    chosen.locked = true
    chosen.lockedDoorCode = code
    api.info?.(`🔒 「上锁的门」封锁了「${chosen.name}」。`)
    return true
  },
}
