// 05091 女巫集会的女祭司
// 归属：战役共用 · theCircleUndone；遭遇组：anettes_coven
// 卡面：反击。
// 卡面：遭遇弃牌堆每有 1 个[[女巫]]敌人，女巫集会的女祭司得到 +1 攻击和 +1 躲避
//   （最多 +3 攻击和 +3 躲避）。
// 卡面：强制 - 在遭遇牌库的卡牌耗尽时：女巫集会的女祭司重整并攻击其所在地点的每位调查员。
//
// 攻击/躲避修正走 enemyStatRule 数据 + encounter-rules.js 的共享 enemyStatModifier 钩子
//（内容层不写卡号）；遭遇牌库耗尽的触发由共享 encounterDrawn 钩子分派到 onEncounterDeckEmpty。

import { activeInvestigators } from '../../../_shared.js'

export default {
  code: '05091',
  scope: 'enemy',
  implemented: true,
  enemyStatRule: { fightEvadePerWitchInDiscard: { cap: 3 } },
  enemyScript: {
    onEncounterDeckEmpty(state, enemy, api) {
      enemy.exhausted = false
      api.info?.('遭遇牌库耗尽：女巫集会的女祭司重整并攻击其所在地点的每位调查员。')
      if (api.cannotAttack?.(enemy)) return
      for (const inv of activeInvestigators(state).filter(target => target.location === enemy.location)) {
        api.attack(enemy, inv)
        if (inv.defeated || inv.resigned) break
      }
    },
  },
}
