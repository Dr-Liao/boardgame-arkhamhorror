// 07094 长翼者 · 印斯茅斯之雾
//
// 印刷（英文原文 / 中文）：
//   Hunter. / 猎手。
//   X is the shroud value of Winged One's location. / X为长翼者所在地点的隐藏值。
//   Winged One takes 1 fewer damage from attacks except by [[Ranged]], [[Firearm]], or [[Spell]]
//   cards (to a minimum of 1 damage). / 除[[远程]]、[[枪械]]、[[法术]]卡牌外，长翼者每次从攻击
//   受到的伤害减少1点(最低减至1点)。
//
// 口径记录：印刷的「X」在这张卡正文里**没有被任何句子引用**（英文原文同样只有定义没有用法，
// 属于印刷遗留）。按「印刷主文优先、差异写审计」的口径不为它虚构效果；猎手与减伤都按印刷实现。
//
// 引擎读点：
//   · `enemyRule.damageReductionExceptSourceTraits`：读点在 combat.js 的攻击伤害段（与既有的
//     damageReductionWhileExhausted 同一处），按**攻击来源卡**的特性判定；空手攻击没有来源卡，
//     同样减伤；下限 1 点（不是 0）。
//   · 「猎手」由关卡遭遇定义按印刷文本提供，条目不再重复声明。

export default {
  code: '07094', scope: 'enemy', implemented: true,
  enemyRule: {
    damageReductionExceptSourceTraits: {
      amount: 1,
      minimum: 1,
      traits: ['Ranged', 'Firearm', 'Spell'],
    },
  },
}
