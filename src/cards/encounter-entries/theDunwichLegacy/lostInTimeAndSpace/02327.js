// 02327 伊哈格尔的阶梯
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 将伊哈格尔的阶梯放置入场。然后，抽取你弃牌堆最顶上的[[疯狂]]卡牌。
// 卡面：强制 - 在你将要离开伊哈格尔的阶梯时：检定 [willpower] (2)。如果你检定失败，不移动到你原本的目的地，改为将伊哈格尔的阶梯混洗入遭遇牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02327', scope: 'location',
  locationRule: {
    onDraw(state, loc, api, seat) {
      const inv = state.investigators[seat]
      const index = inv.discard.findLastIndex(card => ALL_CARDS[card]?.traits?.includes('Madness'))
      if (index >= 0) api.drawDiscard(seat, index)
    },
    onLeave: {
      test: { skill: 'willpower', difficulty: 2 },
      cancelMessage: '🌀 「雅哈格勒之阶」：意志检定失败，移动被取消。',
      onFail(state, loc, api) {
        api.remove(loc.id)
        state.encounterDeck.push('02327')
        api.shuffleEncounterDeck()
      },
    },
  },
}
