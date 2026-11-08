// 08027 战斗训练
// 卡面：快速。[[沉稳]]卡牌场上仅限1张。
//       你得到 +1[combat] 和 +1[agility]。
//       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给战斗训练。
//       [free] 花费 1 资源：你本次技能检定得到 +1[combat] 或 +1[agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：这是「沉稳」天赋的通用数据写法（与 03107 战斗训练同构）：
//   · fast / composure 条目字段提供「快速」「沉稳场上仅限 1 张」「伤害必须优先分配」三个读点；
//   · +1/+1 走 modifiers；
//   · 每次技能检定花 1 资源 +1 走 freeTriggers。
import { skillModifier } from './_shared.js'

export default {
  code: '08027',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
    { skill: 'agility', cost: { resources: 1 }, bonus: 1 },
  ],
  modifiers: [
    skillModifier('combat', 1),
    skillModifier('agility', 1),
  ],
  abilities: [],
}
