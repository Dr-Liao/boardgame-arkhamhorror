// 08069 情绪稳定（Grounded）· 秘术师（Mystic）资产 · 3 经验（03113 的升级版）。
//
// 卡面：快速。[[沉稳]]卡牌场上仅限 1 张。
//       你在 [[法术]] 卡牌的技能检定期间得到 +1 技能值。
//       非直接伤害/恐惧在分配到你的调查员卡牌之前，必须先分配给情绪稳定。
//       [free] 在 [[法术]] 卡牌的技能检定期间，花费 1 资源：你本次检定得到技能值 +1。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：composure（沉稳：非直接恐惧先分配）+ freeTriggers（法术检定花 1 资源 +1，requireTestTrait）；
// 被动 +1 用 modifier 的条件函数（source 卡面特性含 Spell 的技能检定）。
// 与 08056 相同，非直接伤害分支待 primitive request（composureDamage）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const testSourceHasTrait = (state, trait) => {
  const code = state?.skillTest?.source?.code
  if (!code) return false
  return (ALL_CARDS[code]?.traits || []).some(item => String(item).toLowerCase() === String(trait).toLowerCase())
}

export default {
  code: '08069',
  fast: true,
  composure: true,
  freeTriggers: [
    { skill: 'any', cost: { resources: 1 }, bonus: 1, requireTestTrait: 'Spell' },
  ],
  abilities: [],
  modifiers: [
    { target: 'skill:*', amount: 1, condition: { when: ({ state }) => testSourceHasTrait(state, 'Spell') } },
  ],
}
