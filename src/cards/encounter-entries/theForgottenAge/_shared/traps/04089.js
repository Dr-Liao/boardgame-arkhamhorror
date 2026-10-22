// 04089 半身入土
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：traps
// 卡面：显现 - 将半身入土放置入场，放到你的威胁区域。
// 卡面：你不能与敌人解除交战，也不能移动。
// 卡面：[action]：检定[agility](4)来逃出墓穴，或者检定[combat](4)来挣脱束缚。如果你检定成功，弃掉半身入土。如果你检定失败，本次检定的难度降低1点，直到一轮结束。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04089', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
  threatAction: { rule: 'escapeEntombed', label: '逃出墓穴', skills: ['agility', 'combat'], difficulty: 4, target: 'threat', skillLabels: { agility: '检定敏捷(4)逃出墓穴', combat: '检定战斗(4)逃出墓穴' } },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => originalOf(item) === '04089')) {
      api.drawEncounter(inv.seat)
      return false
    }
    api.threat(inv.seat, '04089', { noMove: true, noDisengage: true })
    return true
  },
}
