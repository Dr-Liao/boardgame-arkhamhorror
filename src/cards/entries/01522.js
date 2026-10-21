// 01522 证据！
// 卡面：快速。在你击败一个敌人后打出。
// 卡面：发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01522 证据！：快速事件；击败敌人后发现同地点 1 个线索。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '01522',
  abilities: [
    {
      kind: 'reaction', trigger: 'defeatEnemy', label: '发现同地点 1 个线索',
      fromHand: true,
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1),
    },
  ],
  modifiers: [

  ],
}
