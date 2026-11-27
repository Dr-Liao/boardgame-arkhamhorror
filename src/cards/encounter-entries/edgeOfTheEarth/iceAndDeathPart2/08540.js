// 08540 詹姆斯·“曲奇”·弗雷德里克斯 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08540'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08719', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：战斗(2)，每超过难度 1 点放置 1 资源',
    kind: 'test', skill: 'combat', difficulty: 2, perOverSuccess: true, thresholdPerInvestigator: 2,
  })],
}
