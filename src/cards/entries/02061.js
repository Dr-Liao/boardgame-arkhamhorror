// 02061 沃伦·莱斯教授
// 卡面：你得到+1[intellect]。
// 卡面：[reaction]你发现自己地点最后的线索后，横置沃伦·莱斯教授：抽取一张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02061 沃伦·莱斯教授：+1 智识；[反应]发现所在地点最后 1 个线索后横置抽 1。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '02061',
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'clueDiscovered', label: '横置：抽 1 张牌',
      criteria: [ownSeat(), ctx => ctx.context?.location === ctx.inv?.location && ctx.context?.lastClue === true],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
    },
  ],
}
