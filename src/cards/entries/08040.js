// 08040 科学理论
// 卡面：快速。[[沉稳]]卡牌场上仅限1张。
//       你得到 +1[intellect] 和 +1[combat]。
//       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给科学理论。
//       [free] 花费 1 资源：你本次技能检定得到 +1[intellect] 或 +1[combat]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：与 03109 科学理论同构的「沉稳」天赋数据写法：fast / composure / freeTriggers + modifiers。
import { skillModifier } from './_shared.js'

export default {
  code: '08040',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'intellect', cost: { resources: 1 }, bonus: 1 },
    { skill: 'combat', cost: { resources: 1 }, bonus: 1 },
  ],
  modifiers: [
    skillModifier('intellect', 1),
    skillModifier('combat', 1),
  ],
  abilities: [],
}
