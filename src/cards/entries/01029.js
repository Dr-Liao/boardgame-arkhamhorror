// 01029 霰弹枪
// 卡面：使用(2子弹)。
// 卡面：[action]花费1子弹：攻击。你本次攻击得到+3[combat]。本次攻击不造成标准伤害，改为你检定成功且每超过难度1点，造成1点伤害(最小为1，最大为5)。如果你检定失败并将要对另一位调查员造成伤害，每低于难度1点，造成1点伤害(最小为1，最大为5)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01029',
  uses: 2,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '开火（战斗 +3，按超过难度造成 1~5 伤害）',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        combatBonus: 3,
        successDamage: 'overDifficulty',
        minDamage: 1,
        maxDamage: 5,
        failByAmountToEngaged: true,
      },
    },
  ],
  modifiers: [

  ],
}
