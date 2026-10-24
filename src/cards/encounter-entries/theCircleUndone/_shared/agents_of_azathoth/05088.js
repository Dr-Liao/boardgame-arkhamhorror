// 05088 阿撒托斯的吹笛手
// 归属：战役共用 · theCircleUndone；遭遇组：agents_of_azathoth
// 卡面：猎物 - 剩余神智值最低。警戒。猎手。反击。
// 卡面：强制 - 在敌军阶段结束时：阿撒托斯的吹笛手攻击其所在地点未与其交战的每位调查员
//   （不论其是处于重整状态还是横置状态）。
//
// 印刷数值（5/2/7、伤害 0 恐惧 2、胜利 2、警戒/猎手/反击）由 definition.js 从 card-data.js
// 的印刷数据生成；本条目只补「印刷文本解析器认不出」的猎物 key 与敌军阶段结束的强制攻击。

import { activeInvestigators, originalOf } from '../../../_shared.js'

export default {
  code: '05088',
  scope: 'enemy',
  implemented: true,
  // 猎物：剩余神智值最低（card-data 的 printedPrey 是英文短语，引擎 PREY_RANK 用这些 key）。
  enemyRule: { prey: 'lowestSanity' },
  enemyScript: {
    onEnemyPhaseEnd(state, enemy, api) {
      if (originalOf(enemy) !== '05088') return
      if (!state.enemies.includes(enemy) || enemy.location == null) return
      if (api.cannotAttack?.(enemy)) return
      // 不论调查员重整/横置都攻击；已与该敌人交战的不重复攻击。
      for (const inv of activeInvestigators(state).filter(target => target.location === enemy.location)) {
        if (enemy.engagedSeat === inv.seat) continue
        api.attack(enemy, inv)
        if (inv.defeated || inv.resigned) break
      }
    },
  },
}
