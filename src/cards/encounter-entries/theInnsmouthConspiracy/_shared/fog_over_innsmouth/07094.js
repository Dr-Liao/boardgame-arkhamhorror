// 07094 长翼者（Winged One）· 印斯茅斯之雾
//
// 印刷（中文）：
//   猎手。
//   长翼者的躲避值为X，X为长翼者所在地点的隐藏值。
//   长翼者每次从攻击中受到的伤害减少1点，除了来自[[远程]]、[[枪械]]或[[法术]]卡牌的攻击
//   （最低减至1点）。
// 印刷（英文原文）：
//   Hunter.
//   X is the shroud value of Winged One's location.
//   Winged One takes 1 fewer damage from attacks except by [[Ranged]], [[Firearm]], or [[Spell]]
//   cards (to a minimum of 1 damage).
//
// 引擎读点：
//   · 「躲避值 = 所在地点隐藏值」= `modifiers` 的 `enemyEvade` 动态修正（读点
//     modifiers.js#entityModifierTotal → enemies.js#enemyEvadeValue）。数据层的 evade 是
//     X 占位符 `-2`，修正量取 `shroud - evade`，使**有效躲避值恰好等于所在地点的隐蔽值**。
//     修复前没有这条修正，引擎按字面 -2 使用，躲避几乎必中（审计 H13）。
//   · `enemyRule.damageReductionExceptSourceTraits`：读点在 combat.js 的攻击伤害段
//     （与 damageReductionWhileExhausted 同一处），按**攻击来源卡**的特性判定；空手攻击
//     没有来源卡，同样减伤；下限 1 点（不是 0）。
//   · 「猎手」由关卡遭遇定义按印刷文本提供，条目不再重复声明。

export default {
  code: '07094', scope: 'enemy', implemented: true,
  modifiers: [{
    target: 'enemyEvade',
    amount: ({ state, entity }) => {
      const location = (state.locations || []).find(item => item.id === entity?.location)
      if (!location) return 0
      return (Number(location.shroud) || 0) - (Number(entity.evade) || 0)
    },
  }],
  enemyRule: {
    damageReductionExceptSourceTraits: {
      amount: 1,
      minimum: 1,
      traits: ['Ranged', 'Firearm', 'Spell'],
    },
  },
}
