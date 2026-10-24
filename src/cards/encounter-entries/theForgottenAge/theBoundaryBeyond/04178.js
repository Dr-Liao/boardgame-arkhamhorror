// 04178 查普尔特佩克山
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在查普尔特佩克山入场后：每位在本地区的调查员随机弃掉2张手牌。
// 卡面：[action]你有至少3张手牌时，弃掉你所有手牌：发现本地区的2个线索。(团队每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { teamOnce, discoverAt } from '../../_shared.js'

// 「团队每轮一次」是否已用完：与 _shared.teamOnce 的 tag 口径一致（scope 'round'）。
const roundUsed = (state, key) => Boolean(state.scenarioFlags?.teamOnce?.[`${key}:${state.round}:r`])

export default {
  code: '04178', scope: 'location',
  locationRule: {
    ancientAction: {
      label: '🃏 弃掉你所有手牌：发现本地点的 2 个线索（团队每轮一次）',
      available(state, inv) {
        if (roundUsed(state, '04178clue')) return false
        return (inv.hand || []).length >= 3
      },
      perform(state, inv, api, location) {
        if (!teamOnce(state, '04178clue', 'round')) { api.info?.('本轮的团队次数已用完。'); return false }
        if ((inv.hand || []).length < 3) return false
        inv.discard.push(...inv.hand)
        inv.hand = []
        discoverAt(state, api, inv, location, 2)
        return true
      },
    },
  },
}
