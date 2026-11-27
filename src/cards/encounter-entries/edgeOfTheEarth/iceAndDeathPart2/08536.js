// 08536 丹佛斯 · 被附身队员
import { possessedRescueAbility } from './_shared.js'

const CODE = '08536'

export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyScript: { partner: '08715', crossOutOnDefeat: true },
  enemyRule: { victory: 1 },
  abilities: [possessedRescueAbility({
    code: CODE, label: '谈判：抽取最多 2 张忒咳哩-哩并放置等量资源',
    kind: 'drawTekeliliForResources', maxDraw: 2, thresholdPerInvestigator: 3,
  })],
}
