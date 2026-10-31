// 06327 短管霰弹枪
// 卡面：使用(2子弹)。
//       [action]花费1子弹：攻击。本次攻击不造成标准伤害，改为你检定成功且每超过难度1点，造成1点伤害
//       (最小为1，最大为6)。如果你检定失败并将要对另一位调查员造成伤害，每低于难度1点，造成1点伤害
//       (最小为1，最大为6)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06327 短管霰弹枪：[[道具]][[武器]][[枪械]][[违法]]，使用(2 子弹)。
//   · 攻击按 Fight 行动结算（effect.type:'fight' 进入攻击行动读点，含借机攻击豁免口径）；
//   · 「不造成标准伤害，改为成功差值每点 1 伤害（1–6）」直接复用攻击流程的通用字段
//     successDamage:'overDifficulty' / minDamage / maxDamage（01029 同一读点）；
//   · 失败误伤另一位调查员「每低于难度 1 点 1 伤害」= failByAmountToEngaged。
// 显式简化：失败误伤的上限由引擎既有读点写死为 5（01029 的口径），卡面写 6；成功伤害按 6 已实现。

export default {
  code: '06327',
  uses: 2,
  usesType: 'ammo',
  simplified: true,
  note: '失败误伤分支的最大值沿用引擎读点写死的 5（01029 的 successDamage/failByAmountToEngaged 共用实现），'
    + '卡面写 6；成功伤害（1–6）与「不造成标准伤害」已实现。',
  abilities: [
    {
      kind: 'action',
      label: '花费 1 子弹：攻击（按成功差值造成 1–6 伤害）',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        successDamage: 'overDifficulty',
        minDamage: 1,
        maxDamage: 6,
        failByAmountToEngaged: true,
      },
    },
  ],
  modifiers: [],
}
