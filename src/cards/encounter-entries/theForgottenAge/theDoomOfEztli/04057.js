// 04057 进入遗迹
// 归属：关卡专用 · theDoomOfEztli（失落的时代 · 埃兹特里的覆灭）
// 遭遇组：eztli
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { takeFromSetAsideInEntry } from '../../_shared.js'

export default {
  code: '04057', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      takeFromSetAsideInEntry(state, '04068')
      const deck = [...(state.explorationDeck || []), 'chamberOfTime']
      if (typeof api.shuffle === 'function') {
        state.explorationDeck = api.shuffle(deck)
      } else {
        const copy = [...deck]
        for (let index = copy.length - 1; index > 0; index--) {
          const target = Math.floor((api.random?.() ?? 0) * (index + 1))
          ;[copy[index], copy[target]] = [copy[target], copy[index]]
        }
        state.explorationDeck = copy
      }
      api.info?.('🧭 「时间石室」洗入探索牌库。')
      const hasChalk = state.investigators
        .filter(inv => !inv.defeated && !inv.resigned)
        .some(inv => api.hasSupply?.(inv.seat, 'chalk'))
      if (hasChalk) {
        api.info?.('✏️ 有人带着粉笔，你们抄下了雕文：本场景移出游戏。')
      } else {
        state.victoryDisplay.push({
          id: 'act:04057', code: '04057', originalCode: '04057',
          victory: 0, vengeance: 1, name: act.name,
        })
        api.info?.('📜 没有粉笔：本场景放进胜利区，并获得复仇 1。')
      }
    },
  },
}
