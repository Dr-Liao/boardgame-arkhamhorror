// 03086 迅捷的拜亚基
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：byakhee
// 卡面：猎物 - 剩余神智值最低。
// 卡面：猎手。反击。
// 卡面：强制 - 在迅捷的拜亚基将要通过猎手关键词移动时：改为其每次移动一个地点，直到进入其猎物所在地点。如果其通过本效果移动了超过一个地点，本阶段其不会攻击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 敌人猎物规则（03086 / 03089 / 03099）。

import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '03086', implemented: true, scope: 'enemy', enemyRule: { prey: 'lowestSanity' },
  enemyScript: {
    onHunterMove(state, enemy, api) {
      let moved = 0
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!active.length) return true
      const remainingSanity = inv => (inv.sanity || 0)
        + (inv.assets || []).reduce((sum, asset) => sum + (ALL_CARDS[asset.code]?.sanity || 0), 0)
        - (inv.horror || 0)
      const prey = active.reduce((best, inv) => remainingSanity(inv) < remainingSanity(best) ? inv : best)
      while (enemy.location !== prey.location) {
        const next = api.hunterStep(enemy, { targets: [prey] })
        if (!next || next === enemy.location) break
        api.moveEnemy(enemy, next)
        moved++
      }
      if (moved > 1) api.skipEnemyAttackThisRound(enemy)
      return true
    },
  },
}
