// 08088 老旧的霰弹枪
// 卡面：使用(0子弹)。打出一张事件卡牌时，将老旧的霰弹枪的使用值视为2。
//       [action]花费1子弹：攻击。你本次攻击得到+3[combat]。本次攻击不造成标准伤害，
//       改为：攻击成功时造成的伤害数量等于你超过难度的值；攻击失败且将对另一位调查员造成伤害时，
//       对该调查员造成的伤害数量等于你低于难度的值。(伤害最小为1，最大为3)。
//
// 读点：
//   · 攻击走 effect.type=fight 的既有字段：successDamage:'overDifficulty'、minDamage/maxDamage、
//     failByAmountToEngaged（失败转嫁交战队友，与 01029 霰弹枪同一读点）。
//   · 「打出一张事件卡牌时使用值视为 2」：eventPlayed 窗口 + api.setAssetUses。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08088',
  uses: 0,
  usesType: 'ammo',
  abilities: [
    { kind: 'action', label: '开火（战斗 +3，按超过难度造成 1~3 伤害）', cost: { action: true, uses: 1 },
      effect: { type: 'fight', combatBonus: 3, successDamage: 'overDifficulty',
        minDamage: 1, maxDamage: 3, failByAmountToEngaged: true } },
    { kind: 'reaction', trigger: 'eventPlayed', label: '打出一张事件后：使用值视为 2',
      criteria: ({ source, context }) => Boolean(source) && Boolean(context?.cardCode || context?.cardId),
      resolve: ({ source, api }) => { if (source) api.setAssetUses(source, 2) } },
  ],
  modifiers: [],
}
