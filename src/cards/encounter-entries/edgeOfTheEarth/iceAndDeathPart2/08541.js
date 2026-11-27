// 08541 艾米·肯斯勒博士 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08541'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08720', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：智力(2)，每超过难度 1 点放置 1 资源',
    kind: 'test', skill: 'intellect', difficulty: 2, perOverSuccess: true, thresholdPerInvestigator: 2,
  })],
}
