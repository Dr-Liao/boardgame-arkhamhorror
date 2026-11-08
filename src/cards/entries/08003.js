// 08003 黑帮暴徒（Mob Goons）· 丹妮拉专属弱点（敌人型弱点）。
//
// 卡面：
//   猎手。猎物 - 仅限丹妮拉·雷耶丝。本敌人的攻击不能被取消。
//   本敌人攻击造成的伤害/恐惧将视为直接伤害/直接恐惧。
//
// 引擎读点：
//   · `enemyWeakness: { hunter, prey }` 由 card-lookup 合并进敌人定义（prey = bearer，即抽到它的调查员）；
//   · `enemyRule.attacksCannotBeCancelled` 已在敌人攻击窗口读取；
//   · `enemyRule.attackHarmDirect` 为 P5 新增读取点：敌人攻击的伤害/恐惧不可分配给支援，按直接伤害结算
//     （请求 Lead 在 enemies.js#enemyAttack 调用 applyHarm 时传入 direct=true）。
export default {
  code: '08003',
  scope: 'enemy',
  enemyWeakness: { hunter: true, prey: true },
  enemyRule: { attacksCannotBeCancelled: true, attackHarmDirect: true },
  abilities: [],
  modifiers: [],
}
