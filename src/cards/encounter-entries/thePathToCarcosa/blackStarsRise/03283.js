// 03283 晋升之门
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：[action][action]：将1个毁灭标记从一个密谋牌库移动到另外一个。然后，在晋升之门上放置2个线索(从供应堆拿取)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03283', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      const decks = state.scenarioFlags.agendaDecks || {}
      const alive = Object.values(decks).filter(deck => deck && !deck.removed)
      const agendaDoom = alive.some(deck => deck.doom > 0)
      // 「从一个密谋牌库移动到另外一个」需要两套都在场；道路开启后只剩一套，能力不可用。
      const reason = alive.length < 2 ? '道路已开启，只剩一套密谋，无法在两套之间移动毁灭'
        : agendaDoom ? null : '“a”“c”两张密谋上都没有毁灭'
      moves.push({ action: 'scenarioAction', rule: 'shiftAgendaDoom', actions: 2,
        label: '花费2行动，将1个毁灭移到另一密谋并放置2个线索',
        reason })
    },
  },
}
