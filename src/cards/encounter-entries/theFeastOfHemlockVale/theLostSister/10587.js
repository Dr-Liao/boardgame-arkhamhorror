// 10587 荧光增生（Luminous Growth）· 诡计（印刷 3 张，遭遇牌库）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：显现 - 如可能，把荧光增生附属到最近且没有荧光增生的已揭示[[黑暗]]地点。
//       所附属地点失去[[黑暗]]特性。所附属地点的敌人 +1 攻击值和 +1 伤害值。
//       [action]：检定[agility](3)。成功则弃掉荧光增生。
//
// 一张卡一个文件：黑暗判定读 chaos.locationIsDark + behavior.suppressedDarkIds（附属 10587 的地点
// 视为不黑暗）；+1 攻击/伤害走 behavior.enemyStatModifier 与 enemyAttackModifier；弃卡是
// 地点的 agility 行动（P8 接 locationRule.action）。
export default {
  code: '10587',
  scope: 'treachery',
  implemented: true,
  flags: {
    attachesToNearestRevealedDarkLocation: true,
    removesDarkTrait: true,
    enemyFightBonus: 1,
    enemyDamageBonus: 1,
    discardTest: { skill: 'agility', difficulty: 3 },
    traits: ['Hazard', 'Flora'],
  },
  note: '近似：显现的附属目标选择与 [action] 弃卡留给 P8 的地点条目通道；本章 behavior 只读其持续效果（去黑暗/加值）。',
}
