// 90085 珍妮的.45双枪（Jenny's Twin .45s <:> A Perfect Fit）· 中立 · 支援/道具/武器/枪械 · 进阶。
// 卡面（cards-data 90085）：费用 X（动态费用）、使用（X 子弹）。
//   珍妮·巴恩斯牌库专用。进阶。
//   [action] 花费 1 子弹：攻击。本次攻击你得到 +2[combat]。本次攻击造成 +1 伤害。
//   [reaction] 在你用上述能力击败一个敌人后，横置珍妮的.45双枪：获得等同该敌人印刷生命值的资源。
//
// 引擎读点：
//   · 动态费用 = chooseResourceCostOnPlay: true（与 02010 原版同一读点：打出时支付 X 资源、X 即为
//     uses/弹药数；读点 actions.js#doPlay 的 X 费用与 newPlayerAssetInstance 的 uses 初始化）。
//   · 攻击 = action 描述子 cost { uses:1 } + effect fight（combatBonus 2 / damageBonus 1），
//     assetId 由 executeDescriptor 自动指向本支援。
//   · 「用上述能力击败敌人后」= 条目级 trackDefeatedEnemyPrintedHealth（enemies.js#defeatEnemy 记录
//     本回合印刷生命合计，读点 action-history.js#defeatedPrintedHealthThisTurn）+ defeatEnemy 窗口反应；
//     横置 = cost.exhaust；获得资源 = api.gainResources。
// 近似：引擎的 defeatedPrintedHealthHistory 记「本回合该调查员击败的所有敌人」而不是「仅本武器这一次」，
//   因此反应获得的是本回合累计值（通常在单回合单武器攻击下等价）；已在 note 说明。
import { defeatedPrintedHealthThisTurn } from '../../engine/action-history.js'
import { ownSeat } from '../../engine/matcher.js'

const code = '90085'

export default {
  code,
  uses: 0,
  usesType: 'ammo',
  chooseResourceCostOnPlay: true,
  trackDefeatedEnemyPrintedHealth: true,
  abilities: [
    {
      kind: 'action',
      label: '双枪射击（战斗 +2，伤害 +1）',
      cost: { uses: 1 },
      effect: { type: 'fight', combatBonus: 2, damageBonus: 1 },
    },
    {
      kind: 'reaction',
      trigger: 'defeatEnemy',
      cost: { exhaust: true },
      criteria: [ownSeat()],
      label: '用双枪击败敌人后：横置，获得等同其印刷生命值的资源',
      resolve: ({ state, inv, api }) => {
        const gained = defeatedPrintedHealthThisTurn(state, inv)
        if (gained <= 0) return
        api.gainResources(inv.seat, gained)
        api.info(`🔫 珍妮的.45双枪：获得 ${gained} 资源（本回合击败敌人的印刷生命合计）。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：[reaction] 的资源数取「本回合该调查员击败敌人的印刷生命合计」（trackDefeatedEnemyPrintedHealth 读点），不是严格「仅本次武器攻击击败的那一个」；单回合只用本武器攻击时两者等价。',
}
