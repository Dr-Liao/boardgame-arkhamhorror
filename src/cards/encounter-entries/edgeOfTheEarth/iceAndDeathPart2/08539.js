// 08539 艾弗里·克莱普尔 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08539'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08718', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：意志或智力(5)，成功放置 1 资源',
    kind: 'test', skills: ['willpower', 'intellect'], difficulty: 5, flatOnSuccess: 1, thresholdPerInvestigator: 1,
  })],
}
