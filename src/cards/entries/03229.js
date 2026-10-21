// 03229 单打独斗
// 卡面：只可作为你的第一个行动打出。
// 卡面：对与你交战的一个敌人造成1点伤害。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownFirstAction } from '../../engine/matcher.js'

export default {
  code: '03229',
  playCondition: [
    { when: ownFirstAction(), message: '只能作为本回合的第一个行动打出' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '单打独斗',
      noOpportunityAttack: true,
      effect: { type: 'dealDamage', amount: 1, target: 'engaged' },
    },
  ],
  modifiers: [

  ],
}
