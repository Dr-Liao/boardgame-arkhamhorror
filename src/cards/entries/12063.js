// 12063 灵性直觉（Spiritual Intuition）
// 卡面：[fast] 花费1资源：你本次技能检定得到+1[willpower]（如果是[[法术]]或[[仪式]]卡牌上的检定，
//         改为+2[willpower]）。
//       [fast] 花费1资源：你本次技能检定得到+1[combat]（如果是[[法术]]或[[仪式]]卡牌上的检定，
//         改为+2[combat]）。
//
// 读点：
//   · 两项 [fast] 均是「检定期间可用的免费能力」→ kind:'free' + trigger ['test.beforeCommit','test.afterCommit']
//     （07266 同一读点）；费用 → cost.resources；
//   · 技能加值 → api.addPendingTestBonus（api-test 的既有入口）；
//   · 「检定在法术/仪式卡牌上」→ 读当前检定的来源卡牌特性（cards-data 的 traits），不另造状态字段。
import { ALL_CARDS } from '../cards-data.js'

const CODE = '12063'

function currentTestSource(state) {
  const code = state.skillTest?.source?.code
  const def = code ? ALL_CARDS[code] : null
  return def || null
}

function onSpellOrRitual(state) {
  const def = currentTestSource(state)
  if (!def) return false
  return (def.traits || []).some(trait => ['spell', 'ritual'].includes(String(trait).toLowerCase()))
}

const during = skill => ({ state, inv }) => state.skillTest?.seat === inv.seat
  && [state.skillTest?.skill].flat().includes(skill)

export default {
  code: CODE,
  abilities: [
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      cost: { action: false, resources: 1 },
      label: '花 1 资源：本次检定意志 +1（法术/仪式来源改为 +2）',
      criteria: during('willpower'),
      resolve: ({ state, api }) => {
        const amount = onSpellOrRitual(state) ? 2 : 1
        api.addTestPendingBonus(amount)
        api.info(`🔮「灵性直觉」：本次检定意志 +${amount}。`)
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      cost: { action: false, resources: 1 },
      label: '花 1 资源：本次检定战斗 +1（法术/仪式来源改为 +2）',
      criteria: during('combat'),
      resolve: ({ state, api }) => {
        const amount = onSpellOrRitual(state) ? 2 : 1
        api.addTestPendingBonus(amount)
        api.info(`🔮「灵性直觉」：本次检定战斗 +${amount}。`)
      },
    },
  ],
  modifiers: [],
}
