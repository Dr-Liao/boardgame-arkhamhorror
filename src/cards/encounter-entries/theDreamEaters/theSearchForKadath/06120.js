// 06120 穿过幻梦境的旅程（theSearchForKadath）· 议程 1（毁灭阈值 7）
// 卡面：[action] 如果你位于[[港口]]地点：撤退。进入未知领域冒险一事变得过于危险，
//       所以你带着目前搜集到的一切返回安全的地方。
// 卡面（背面「冷原海盗的追击」）：将两张放在一边的「冷原海盗」混洗入遭遇牌库，连同遭遇弃牌堆一起。
//
// 一卡一文件：正面撤退由 definition 给[[港口]]地点的 `resign: true` 提供（引擎合法行动）；
// 背面效果在 agendaRule.onReveal（引擎在议程推进时调用 behavior.agendaReveal）。
export default {
  code: '06120', scope: 'agenda', implemented: true,
  agendaRule: {
    portResign: true,
    onReveal(state, agenda, api) {
      let shuffled = 0
      for (let index = 0; index < 2; index += 1) {
        if (!api.takeFromSetAside?.('06105')) break
        shuffled += 1
      }
      if (shuffled) api.shuffleIntoEncounterDeck?.(Array(shuffled).fill('06105'), { shuffle: false })
      api.shuffleDiscard?.()
      api.info?.(`🏴‍☠️ 「冷原海盗的追击」：${shuffled} 张放在一边的冷原海盗与遭遇弃牌堆一起洗入遭遇牌库。`)
      return true
    },
  },
}
