// 01135 追猎鬼影
// 归属：跨战役通用
// 遭遇组：arkham
// 卡面：险境。
// 卡面：显现 - 你必须(选择以下一项)：花费1个线索或受到2点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf, syncCluesInEntry } from '../../_shared.js'

export default {
  code: '01135', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const code = originalOf(card)
    const answer = api.choose?.({
      kind: 'harm', source: code, seat: inv.seat,
      prompt: '追猎鬼影：花费 1 个线索，或受到 2 点伤害。',
      options: [{ id: 'clue', label: '花费 1 个线索' }, { id: 'damage', label: '受到 2 点伤害' }],
    }) ?? ((inv.clues || 0) > 0 ? 'clue' : 'damage')
    if (answer === 'clue' && (inv.clues || 0) > 0) {
      inv.clues -= 1
      syncCluesInEntry(state)
    } else api.damage(inv.seat, 2)
    return false
  },
}
