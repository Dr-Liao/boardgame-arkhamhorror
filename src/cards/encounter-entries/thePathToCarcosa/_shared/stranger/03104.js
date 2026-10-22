// 03104 印记之痕
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：stranger
// 卡面：险境。
// 卡面：显现 - 检定[willpower](2)。如果你检定失败，受到2点恐惧。如果苍白面具下的男子在场，本效果造成的恐惧视为直接恐惧，且本次检定+2难度。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '03104', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const stranger = state.enemies.some(enemy => originalOf(enemy) === '03059')
    api.test(inv.seat, 'willpower', stranger ? 4 : 2, result => {
      if (!result.success) (stranger ? api.directHorror : api.horror)(inv.seat, 2)
    })
    return false
  },
}
