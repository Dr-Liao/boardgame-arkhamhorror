// 04097 力量真言
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：pnakotic_brotherhood
// 卡面：显现 - 将力量真言放置入场，放到你的威胁区域。
// 卡面：如果你所在地点有1个或更多带有毁灭标记的敌人，你不能对这些敌人造成伤害或发现你所在地的线索。
// 卡面：[action][action]：弃掉力量真言。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04097', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
  threatAction: { rule: 'discardWordsOfPower', label: '花 2 个行动弃掉力量真言', actions: 2, target: 'threat', noTest: true },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => originalOf(item) === '04097')) {
      api.drawEncounter(inv.seat)
      return false
    }
    api.threat(inv.seat, '04097', { blockDoomEnemyDamage: true, blockCluesHere: true })
    return true
  },
}
