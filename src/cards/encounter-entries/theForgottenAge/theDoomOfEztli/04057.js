// 04057 进入遗迹
// 归属：关卡专用 · theDoomOfEztli（失落的时代 · 埃兹特里的覆灭）
// 遭遇组：eztli
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04057', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      api.takeFromSetAside('04068')
      api.addToExplorationDeck(['chamberOfTime'])
      api.info?.('🧭 「时间石室」洗入探索牌库。')
      const hasChalk = state.investigators
        .filter(inv => !inv.defeated && !inv.resigned)
        .some(inv => api.hasSupply?.(inv.seat, 'chalk'))
      if (hasChalk) {
        api.info?.('✏️ 有人带着粉笔，你们抄下了雕文：本场景移出游戏。')
      } else {
        api.addStoryToVictory('04057', { sourceId: 'act:04057', vengeance: 1 })
        api.info?.('📜 没有粉笔：本场景放进胜利区，并获得复仇 1。')
      }
    },
  },
}
