// 01085 生存意志
// 卡面：快速。只能在你回合期间打出。
// 卡面：你执行的所有技能检定都不揭示混乱记，直到你回合结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '01085',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [
    { kind: 'played', label: '生存意志', fast: true, effect: { type: 'ignoreChaos' } },
  ],
  modifiers: [

  ],
}
