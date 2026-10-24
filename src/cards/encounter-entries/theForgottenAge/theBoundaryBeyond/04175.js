// 04175 大神庙
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：强制 - 在大神庙入场后：将你的弃牌堆洗入你的牌库。从你的牌库顶弃牌，直到弃掉一张弱点卡牌。抽取该弱点。
// 卡面：[action]将你弃牌堆的一张弱点卡牌洗入你的牌库：发现本地点的2个线索。(团队每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 92 轮：边界之外四张古代地点的「团队每轮一次」发现线索行动。

import { ALL_CARDS, isWeaknessCode, teamOnce, discoverAt, shuffleDeckWith } from '../../_shared.js'

// 「团队每轮一次」是否已用完：与 _shared.teamOnce 的 tag 口径一致（scope 'round'）。
// legalMoves 的 available 必须读同一个标记，否则按钮会在用完时仍然可点，
// 执行时 perform 返回 false 而行为层抛错（runtime-1 的 ancientClue 中断）。
const roundUsed = (state, key) => Boolean(state.scenarioFlags?.teamOnce?.[`${key}:${state.round}:r`])

export default {
  code: '04175', scope: 'location',
  locationRule: {
    ancientAction: {
      label: '♻️ 把弃牌堆的一张弱点洗回牌库：发现本地点的 2 个线索（团队每轮一次）',
      available(state, inv) {
        if (roundUsed(state, '04175clue')) return false
        return (inv.discard || []).some(isWeaknessCode)
      },
      perform(state, inv, api, location) {
        if (!teamOnce(state, '04175clue', 'round')) { api.info?.('本轮的团队次数已用完。'); return false }
        const candidates = [...new Set((inv.discard || []).filter(isWeaknessCode))]
        const chosen = candidates.length === 1 ? candidates[0] : api.choose({
          kind: 'card', source: '04175', seat: inv.seat,
          prompt: '选择一张要洗回牌库的弱点卡牌。',
          options: candidates.map(code => ({ id: code, label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code })),
        })
        const index = (inv.discard || []).indexOf(chosen)
        if (index < 0) return false
        inv.discard.splice(index, 1)
        inv.deck.push(chosen)
        shuffleDeckWith(state, inv, api)
        discoverAt(state, api, inv, location, 2)
        return true
      },
    },
  },
}
