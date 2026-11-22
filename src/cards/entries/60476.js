// 60476 灵感敏锐（Spiritual Intuition，Marie Lambeau，3 XP）
// 卡面：起始。（你每场游戏开始的起始手牌可以加入 1 张「起始」关键词的卡牌。）
//       [fast] 花费 1 资源：本次技能检定得到 +1[willpower]（如果是[[法术]]或[[仪式]]卡牌上的检定，改为 +2）。
//       [fast] 花费 1 资源：本次技能检定得到 +1[combat]（如果是[[法术]]或[[仪式]]卡牌上的检定，改为 +2）。
import { ownSeat } from '../../engine/matcher.js'
import { ALL_CARDS } from '../cards-data.js'

const spellOrRitualTest = state => {
  const code = state.skillTest?.source?.code
  const card = code ? ALL_CARDS[code] : null
  return Boolean(card) && (card.traits || []).some(trait =>
    ['spell', 'ritual'].includes(String(trait).toLowerCase()))
}

export default {
  code: '60476',
  flags: { starting: true },
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花费 1 资源：本次检定 +1 意志（法术/仪式卡牌上的检定 +2）',
      cost: { resources: 1 },
      criteria: [ownSeat(), ({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(spellOrRitualTest(state) ? 2 : 1),
    },
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花费 1 资源：本次检定 +1 战斗（法术/仪式卡牌上的检定 +2）',
      cost: { resources: 1 },
      criteria: [ownSeat(), ({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(spellOrRitualTest(state) ? 2 : 1),
    },
  ],
}
