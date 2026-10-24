// 04050 探险营地
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：[action]：撤退。荒野实在太危险了！
// 卡面：[action]：检查你的补给品。如果你带有地图，查看探索牌库顶的3张卡牌。按任意顺序将其中1张放在牌库底，其余2张放在牌库顶。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 115 轮：荒莽密林（失落时代第一章）的地点 / 幕 / 密谋规则。
// 章节 behavior 只保留通用分派（beforeExplore / afterExplore / afterTest /
// locationRule.actions / performAction / actRule / agendaRule）。
// 探险营地（04050）：撤退与「检查补给」两个场景行动。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '04050', scope: 'location', flags: { expeditionCamp: true },
  locationRule: {
    actions({ state, inv, moves }) {
      moves.push({ action: 'scenarioAction', rule: 'resignCamp', label: '⛺ 撤退：荒野实在太危险了！' })
      // 卡面：只有带有地图才能用「检查补给」看探索牌库顶 3 张；没有地图不显示按钮。
      const supplies = state.campaign?.supplies?.[inv.seat] || inv.supplies || []
      if (supplies.includes('map')) {
        moves.push({ action: 'scenarioAction', rule: 'mapSupplies', label: '🗺️ 检查补给：用地图查看探索牌库顶 3 张' })
      }
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'resignCamp') { api.resign(inv.seat); return true }
      if (move.rule !== 'mapSupplies') return false
      if (!api.checkSupplies(inv.seat, 'map')) {
        api.info?.('检查补给：队伍中没有地图，这次行动没有效果。')
        return true
      }
      const deck = state.explorationDeck || []
      const top = deck.slice(-3).reverse()
      if (!top.length) return true
      const labelOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
      const bottom = api.choose({
        kind: 'deck', source: '04050', seat: inv.seat,
        prompt: '选择 1 张放在探索牌库底部（其余 2 张随后按你选择的顺序放回顶部）。',
        options: top.map((code, index) => ({ id: String(index), label: labelOf(code) })),
      })
      const picked = top[Number(bottom)] || top[0]
      const rest = top.filter(entry => entry !== picked)
      // 其余 2 张也要「按任意顺序」放回牌库顶：再问一次谁在最上面。
      const firstAnswer = rest.length === 2
        ? api.choose({
          kind: 'deck', source: '04050', seat: inv.seat,
          prompt: '选择其余 2 张中先放回牌库顶的那张（另一张在它下面）。',
          options: rest.map((code, index) => ({ id: String(index), label: labelOf(code) })),
        })
        : '0'
      const first = rest[Number(firstAnswer)] || rest[0]
      const ordered = rest.length === 2 ? [first, rest.find(entry => entry !== first)] : rest
      // 探索牌库数组的末尾是牌库顶（campaign-plugin.js 的 doExplore 用 pop 抽牌），
      // 所以「放在牌库底」= 放到数组最前面；其余两张按选择顺序放到末尾（first 在最顶）。
      state.explorationDeck = [
        picked,
        ...deck.slice(0, Math.max(0, deck.length - top.length)),
        ...[...ordered].reverse(),
      ]
      api.info?.('地图：一张牌放在探索牌库底部，其余两张按你选择的顺序回到顶部。')
      return true
    },
  },
}
