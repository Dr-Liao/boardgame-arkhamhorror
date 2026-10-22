// 04077 丛林之声
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：显现 - 将丛林之声放置入场，放到你的威胁区域。
// 卡面：强制 - 当你的回合结束时，如果你本回合未探索成功：受到1点恐惧。
// 卡面：[action]：检定[willpower](3)。如果你检定成功，弃掉丛林之声。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04077', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
  threatAction: { rule: 'endVoiceOfTheJungle', label: '检定意志(3)驱散丛林之声', skills: ['willpower'], difficulty: 3, target: 'threat' },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => originalOf(item) === '04077')) {
      api.drawEncounter(inv.seat)
      return false
    }
    api.threat(inv.seat, '04077', { forcedEndTurnHorror: 1 })
    return true
  },
}
