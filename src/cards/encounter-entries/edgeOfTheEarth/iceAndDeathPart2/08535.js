// 08535 威廉·戴尔教授 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08535'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08714', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '弃掉最多 2 张手牌：谈判',
    kind: 'discardForResources', maxDiscard: 2, thresholdPerInvestigator: 3,
  })],
}
