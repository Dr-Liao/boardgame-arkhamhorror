// 02080 佛朗西斯·摩尔根博士
// 卡面：你得到+1[combat]。
// 卡面：[reaction]你击败一个敌人后 ，横置佛朗西斯·摩尔根博士：抽取1张卡牌 。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02080 佛朗西斯·摩尔根博士：+1 战斗；击败敌人后横置抽 1。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '02080',
  modifiers: [
    skillModifier('combat', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'defeatEnemy', label: '横置：抽 1 张牌',
      criteria: [ownSeat()], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    },
  ],
}
