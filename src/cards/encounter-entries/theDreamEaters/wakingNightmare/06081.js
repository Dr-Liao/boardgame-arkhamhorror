// 06081 可疑的护工（Suspicious Orderly）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：猎手。可疑的护工不能攻击、不能被攻击、也不能被造成伤害。
//   当可疑的护工与你交战时，你不能调查。
// 数值由 definition 提供（印刷数据没有攻击值/生命值：卡面本就没有）。
// 读点（Lead 口径 3）：条目声明 flags，章节 behavior 接到引擎读点：
//   - behavior.enemyCannotAttack（hidden-rules.js 读 scenarioBehavior.enemyCannotAttack）
//   - behavior.enemyCannotBeAttacked（hidden-rules.js）
//   - behavior.enemyDamageAllowed 返回 false（enemies.js 的 damageEnemy 读点）
//   - behavior.enemyCanBeDefeated 返回 false（hidden-rules.js）
//   - behavior.investigationError（章节钩子；moves.js/actions-extra.js 读点）
//   - behavior.canEngageEnemy 不受影响（卡面允许被交战）。
export default {
  code: '06081',
  scope: 'enemy',
  implemented: true,
  flags: {
    cannotAttack: true,
    cannotBeAttacked: true,
    cannotBeDamaged: true,
    cannotBeDefeated: true,
    blocksInvestigationWhileEngaged: true,
  },
}
