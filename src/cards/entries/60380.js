// 60380 三寸之舌（Silver Tongue，André Patel，3 XP）
// 卡面：起始。（你每场游戏开始的起始手牌可以加入 1 张「起始」关键词的卡牌。）
//       [fast] 花费 1 资源：本次技能检定得到 +1[intellect]（如果是躲避或谈判，改为 +2[intellect]）。
//       [fast] 花费 1 资源：本次技能检定得到 +1[agility]（如果是躲避或谈判，改为 +2[agility]）。
import { ownSeat } from '../../engine/matcher.js'

const parleyOrEvade = state => ['evade', 'parley'].includes(state.skillTest?.actionKind)

export default {
  code: '60380',
  flags: { starting: true },
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花费 1 资源：本次检定 +1 智力（躲避/谈判 +2）',
      cost: { resources: 1 },
      criteria: [ownSeat(), ({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(parleyOrEvade(state) ? 2 : 1),
    },
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      label: '花费 1 资源：本次检定 +1 敏捷（躲避/谈判 +2）',
      cost: { resources: 1 },
      criteria: [ownSeat(), ({ state }) => Boolean(state.skillTest)],
      resolve: ({ state, api }) => api.addTestValue(parleyOrEvade(state) ? 2 : 1),
    },
  ],
}
