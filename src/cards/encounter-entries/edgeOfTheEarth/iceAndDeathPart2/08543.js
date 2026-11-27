// 08543 高田弘子 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08543'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08722', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '花费最多 3 资源：谈判',
    kind: 'spendResources', maxSpend: 3, thresholdPerInvestigator: 5,
  })],
}
