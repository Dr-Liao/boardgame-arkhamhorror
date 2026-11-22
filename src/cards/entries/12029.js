// 12029 温彻斯特12型霰弹枪
// 卡面：使用(3子弹)。
// 卡面：[action]花费1子弹：攻击([combat])。你本次攻击得到+3[combat]。如果你检定成功，你每超过难度1点，
//       本次攻击造成伤害+1(最多+4)。如果你检定失败并将要对另一位调查员造成伤害，每低于难度1点，
//       本次攻击造成1点伤害(最多为5)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 使用次数 = 条目级 uses/usesType（实例初始化与 cost.uses 扣费，同 01016/01029）；
//   · [action] 攻击 = action 描述子 + countsAs:'fight' + target:{kind:'enemy'} + api.fight；
//   · 「每超过难度 1 点 +1 伤害（最多 +4）」= api.fight 的 onSuccess 回调（成功判定后、
//     伤害合计前回调，与 10021 同一读点），把 min(4, 成功差值) 累加进 opts.damageBonus；
//   · 「失败并对另一位调查员造成伤害」= doFight 的 failByAmountToEngaged / failMaxDamage 读点
//     （引擎按失败差值计算误伤，最多 5，与 01029 霰弹枪同一口径）。

import { attackableEnemies } from './_shared.js'

const CODE = '12029'
const MAX_SUCCESS_DAMAGE_BONUS = 4

export default {
  code: CODE,
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '射击：战斗 +3；成功时每超过难度 1 点伤害 +1（最多 +4）',
      target: {
        kind: 'enemy',
        query: ({ state, inv, entity }) => attackableEnemies(state, inv).includes(entity),
      },
      cost: { action: true, uses: 1 },
      resolve: ({ inv, target, api }) => {
        if (!target) return
        api.fight(inv.seat, target.id, {
          combatBonus: 3,
          failByAmountToEngaged: true,
          failMaxDamage: 5,
          onSuccess: ({ result, opts }) => {
            const successBy = Math.max(0, Number(result?.value) - Number(result?.difficulty))
            const bonus = Math.min(MAX_SUCCESS_DAMAGE_BONUS, successBy)
            if (!bonus) return
            opts.damageBonus = (opts.damageBonus || 0) + bonus
          },
        })
      },
    },
  ],
  modifiers: [
  ],
}
