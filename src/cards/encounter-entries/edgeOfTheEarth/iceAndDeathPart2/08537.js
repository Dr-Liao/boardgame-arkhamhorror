// 08537 伊里亚·阿什瓦克 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08537'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08716', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：敏捷(2)，每超过难度 1 点放置 1 资源',
    kind: 'test', skill: 'agility', difficulty: 2, perOverSuccess: true, thresholdPerInvestigator: 2,
  })],
}
