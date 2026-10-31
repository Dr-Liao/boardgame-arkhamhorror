// 06092 笨拙的古革巨人（Lumbering Gug，敌人，1 张）
// 归属：战役共用 · theDreamEaters._shared。遭遇组：creatures_of_the_underworld（ATSOH / PONR）。
// 卡面：强制 - 笨拙的古革巨人横置后：其在下一个补给阶段期间不重整。
// 实现：引擎 upkeep 重整读 enemy.preventReady = { from, rounds }（phases.js），但内容层没有写该
//   字段的 api（R1 禁止直写）。已登记 primitive request w-p8-f-prevent-enemy-ready：
//   api.preventEnemyReady(enemy, rounds)。接线点：onAttackResolved（攻击后横置）与 enemyScript.onEvade。
export default {
  code: '06092',
  scope: 'enemy',
  implemented: true,
  // api.preventEnemyReady 写 enemy.preventReady（phases.js 读：下一个补给阶段不重整）。
  enemyScript: {
    onAttackResolved(state, enemy, inv, api) {
      api.preventEnemyReady?.(enemy, 1)
    },
    onEvade(state, inv, enemy, result, api) {
      api.preventEnemyReady?.(enemy, 1)
    },
  },
}
