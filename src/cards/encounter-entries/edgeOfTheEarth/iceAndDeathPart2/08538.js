// 08538 玛拉·辛哈医生 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08538'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08717', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：意志(2)，每超过难度 1 点放置 1 资源',
    kind: 'test', skill: 'willpower', difficulty: 2, perOverSuccess: true, thresholdPerInvestigator: 2,
  })],
}
