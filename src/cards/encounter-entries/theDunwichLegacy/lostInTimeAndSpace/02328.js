// 02328 次元之门
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：显现 - 将次元之门放置入场。然后，抽取遭遇弃牌堆最顶上的[[巫术]]卡牌。
// 卡面：强制 - 当你的回合结束时，如果你在次元之门：你必须花费2资源或将次元之门混洗入遭遇牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02328', scope: 'location',
  locationRule: {
    onDraw(state, loc, api, seat) {
      const index = state.encounterDiscard.findLastIndex(code =>
        ALL_CARDS[code]?.traits?.includes('Hex') || state.scenario.treacheries[code]?.traits?.includes('Hex'))
      if (index >= 0) api.drawEncounterDiscard(seat, index)
    },
  },
}
