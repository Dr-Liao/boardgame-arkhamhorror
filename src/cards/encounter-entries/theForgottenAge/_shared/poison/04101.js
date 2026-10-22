// 04101 毒性蔓延
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：poison
// 卡面：涌动。
// 卡面：显现 - 中毒的每位调查员受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04101', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
      const poisoned = (target.threat || []).some(item => originalOf(item) === '04102') || target.poisoned === true
      if (poisoned) api.damage(target.seat, 1)
    }
    return false
  },
}
