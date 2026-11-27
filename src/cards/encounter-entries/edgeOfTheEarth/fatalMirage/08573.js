// 08573 奥斯曼前线：这里的非精英敌人战斗 +2 并失去反击。
import { partnerShroud } from './_shared.js'

export default {
  code: '08573', scope: 'location', implemented: true,
  flags: { mirageId: 'ottomanFront', tier: 2 },
  locationRule: {
    shroudModifier: partnerShroud('08592', '08719'),
    enemyKeywordDisabled: { nonElite: ['retaliate'] },
  },
  modifiers: [{ target: 'enemyFight', amount: 2,
    condition: { when: ({ state, entity }) => state.enemies.includes(entity) && !entity.elite } }],
}
