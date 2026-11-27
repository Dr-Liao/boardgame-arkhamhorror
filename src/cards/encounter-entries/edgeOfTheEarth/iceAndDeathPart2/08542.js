// 08542 罗尔德·埃尔斯沃思 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08542'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08721', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：战斗或敏捷(5)，成功放置 1 资源',
    kind: 'test', skills: ['combat', 'agility'], difficulty: 5, flatOnSuccess: 1, thresholdPerInvestigator: 1,
  })],
}
