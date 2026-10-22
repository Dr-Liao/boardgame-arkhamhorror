// 04099 毒蛇灾厄
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：venom
// 卡面：显现 - 将毒蛇灾厄放置入场，放到你的威胁区域。如果你已中毒，毒蛇灾厄获得涌动。
// 卡面：将你的每个非弱点[[道具]]支援的文本框(除[[特性]]外)视为空白。
// 卡面：强制 - 当一轮结束时：弃掉毒蛇灾厄。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04099', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true},
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => originalOf(item) === '04099')) {
      api.drawEncounter(inv.seat)
      return false
    }
    const poisoned = (inv.threat || []).some(item => originalOf(item) === '04102') || inv.poisoned === true
    api.threat(inv.seat, '04099', { blankItemAssets: true, forcedRoundEndDiscard: true })
    if (poisoned) api.drawEncounter(inv.seat)
    return true
  },
}
