// 01037 专业的直觉
// 卡面：快速。只能在你回合期间打出。
// 卡面：发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '01037',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      label: '专业的直觉',
      fast: true,
      effect: { type: 'discoverClue', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
