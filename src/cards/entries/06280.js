// 06280 绞喉索
// 卡面：[fast]在你回合期间，横置绞喉索：攻击。你本次攻击得到+2[combat]。
//       只能对剩余生命值为正好1点的敌人进行本次攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06280 绞喉索：配件 [[道具]][[武器]]。
//   · 能力是 [fast]（不花行动，只用横置自身作费用）→ cost:{ action:false, exhaust:true }；
//   · 卡面「攻击。」= Fight 行动 → countsAs:'fight'（借机攻击豁免读点）；
//   · 「只能对剩余生命值为正好 1 点的敌人」写在 target.query 上（legalMoves/validateMove/执行同源），
//     引擎按 candidate.entity 读 health/damageTaken；
//   · 攻击本身走 api.fight + combatBonus:2，noSpend:true（行动/横置已由描述子费用结算）。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '06280',
  abilities: [
    {
      kind: 'action',
      label: '横置：攻击（战斗 +2，仅限剩余生命为 1 的敌人）',
      cost: { action: false, exhaust: true },
      countsAs: 'fight',
      criteria: [ownTurn()],
      target: {
        kind: 'enemy',
        label: '剩余生命值正好为 1 的敌人',
        query: ({ candidate }) => {
          const enemy = candidate?.entity
          if (!enemy) return false
          const health = Number(enemy.health) || 0
          const damageTaken = Number(enemy.damageTaken) || 0
          return health - damageTaken === 1
        },
      },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, { combatBonus: 2, noSpend: true })
      },
    },
  ],
  modifiers: [],
}
