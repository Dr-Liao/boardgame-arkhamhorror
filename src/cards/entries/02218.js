// 02218 厄尔·索耶
// 卡面：你得到+1[agility]。
// 卡面：[reaction] 你躲避一个敌人后，横置厄尔·索耶：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02218 厄尔·索耶：+1 敏捷；躲避成功后横置抽 1。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '02218',
  assetRule: { cancelTreacheryReaction: true },
  scenarioPlayable: true,
  modifiers: [
    skillModifier('agility', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'evadeSuccess', label: '横置：抽 1 张牌',
      criteria: [ownSeat()], cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    },
  ],
}
