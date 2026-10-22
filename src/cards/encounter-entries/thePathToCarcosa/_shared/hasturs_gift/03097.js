// 03097 黄衣之王之舞
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hasturs_gift
// 卡面：显现 - 如果场上没有[[附身]]敌人，黄衣之王之舞获得涌动。否则，检定[willpower](3)。如果你检定失败，最近的[[附身]]敌人重整并移动(每次一个地点)直到它到达你所在地点，与你交战，并立即进行一次攻击。(FAQ，v2.0)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { shortestNextStep } from '../../../_shared.js'

export default {
  code: '03097', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const code = card?.originalCode || card?.code
    const possessed = state.enemies.filter(enemy => enemy.traits?.includes('Possessed'))
    if (!possessed.length) {
      api.drawEncounter(inv.seat)
      return false
    }
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      // 最近的附身敌人：按连接图距离取最小，并列时由玩家选择。
      const distances = new Map()
      const queue = [inv.location]
      distances.set(inv.location, 0)
      while (queue.length) {
        const current = queue.shift()
        const location = state.locations.find(candidate => candidate.id === current)
        for (const next of location?.connections || []) {
          if (distances.has(next) || !state.locations.some(candidate => candidate.id === next)) continue
          distances.set(next, distances.get(current) + 1)
          queue.push(next)
        }
      }
      const ranked = possessed.map(enemy => ({ enemy, distance: distances.get(enemy.location) ?? Infinity }))
      const nearest = Math.min(...ranked.map(item => item.distance))
      const ties = ranked.filter(item => item.distance === nearest)
      const picked = ties.length === 1 ? ties[0].enemy : state.enemies.find(enemy => enemy.id === api.choose({
        kind: 'enemy', source: code, seat: inv.seat,
        prompt: '选择最近的附身敌人（距离相同）。',
        options: ties.map(item => ({ id: item.enemy.id, label: item.enemy.name })),
      })) || ties[0].enemy
      picked.exhausted = false
      // 逐地点移动：每次沿最短路前进一个连接地点。
      for (let guard = 0; guard < 64 && picked.location !== inv.location; guard++) {
        const step = shortestNextStep(state, picked.location, inv.location)
        if (!step || step === picked.location) break
        api.moveEnemy(picked, step)
      }
      api.engage(picked, inv.seat)
      api.attack(picked, inv)
    })
    return false
  },
}
