// 05097 秘社玄仪
// 归属：战役共用 · theCircleUndone；遭遇组：silver_twilight_lodge
// 卡面：显现 - 在最近的一个[[异教徒]]敌人身上放置 1 个毁灭标记。然后，直到一轮结束，
//   对该敌人攻击、躲避或与该敌人谈判的难度 +2。如果未因本效果放置毁灭标记，秘社玄仪获得涌动。
//
// 「难度 +2」写在敌人实例的 roundFightEvadeBonus = { round, amount }：
//   攻击/躲避由 encounter-rules.js 的 enemyStatModifier 读；谈判由 05095/05096 条目读。
// 最近 = BFS 距离最近的异教徒（同距离时让玩家选）。

import { hasTrait } from '../../../_shared.js'

function distance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of (state.locations || []).find(entry => entry.id === id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

export default {
  code: '05097',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const candidates = (state.enemies || []).filter(enemy => hasTrait(enemy, 'Cultist'))
    if (!candidates.length) {
      api.info?.('没有异教徒敌人：秘社玄仪获得涌动。')
      api.drawEncounter?.(inv.seat)
      return false
    }
    const scored = candidates.map(enemy => ({ enemy, steps: distance(state, inv.location, enemy.location) }))
    const nearest = Math.min(...scored.map(entry => entry.steps))
    const pool = scored.filter(entry => entry.steps === nearest).map(entry => entry.enemy)
    const chosen = pool.length === 1 ? pool[0] : pool.find(enemy => enemy.id === api.choose({
      kind: 'enemy', source: '05097', seat: inv.seat,
      prompt: '选择最近的异教徒敌人放置 1 个毁灭标记。',
      options: pool.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })) || pool[0]
    api.doomOn?.(chosen, 1)
    chosen.roundFightEvadeBonus = { round: state.round, amount: 2 }
    api.info?.(`秘社玄仪：在「${chosen.name}」上放置 1 个毁灭标记；直到一轮结束，对其攻击、躲避或谈判的难度 +2。`)
    return false
  },
}
