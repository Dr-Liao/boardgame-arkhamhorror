// 04060 遗迹入口
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：eztli
// 卡面：[action]：撤退。你暂时……逃出来了。
// 卡面：[action]：检查你的补给品。如果你带有火把，查看探索牌库顶的2张卡牌。弃掉每张以此效果查看到的诡计卡牌。混洗探索牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 115 轮：时间倒流（失落时代第四章）的入口地点与幕/密谋背面。
// 幕/密谋同样通过 onReveal 的 hooks 参数调用章节实现（removeSetAside / addActToVictory / …）。

import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '04060', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'resignEntryway', label: '🚪 撤退：你暂时……逃出来了。' })
      moves.push({
        action: 'scenarioAction', rule: 'inspectSupplies',
        label: '🔦 检查补给品：查看探索牌库顶 2 张，弃掉其中的诡计后洗牌',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'resignEntryway') { api.resign(inv.seat); return true }
      if (move.rule !== 'inspectSupplies') return false
      if (!api.checkSupplies(inv.seat, 'torches')) {
        api.info?.('检查补给品：队伍中没有火把，这次行动没有效果。')
        return true
      }
      const deck = state.explorationDeck || []
      const top = deck.slice(-2)
      if (!top.length) return true
      state.explorationDeck = deck.slice(0, deck.length - top.length)
      state.explorationDiscard ||= []
      for (const code of top) {
        if (ALL_CARDS[code]?.type === 'treachery') state.explorationDiscard.push(code)
        else state.explorationDeck.push(code)
      }
      const rng = typeof api.random === 'function' ? api.random : () => 0
      const copy = [...state.explorationDeck]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      state.explorationDeck = copy
      api.info?.('火把照亮了探索牌库顶：诡计被弃掉，其余卡牌洗回牌库。')
      return true
    },
  },
}
