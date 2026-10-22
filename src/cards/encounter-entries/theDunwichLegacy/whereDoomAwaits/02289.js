// 02289 次元裂隙
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：强制 - 在你揭示次元裂隙后：从遭遇牌库顶弃掉卡牌，直到弃掉一个敌人。不将该敌人生成在其通常的生成地点，改为生成在此。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02289', scope: 'location',
  locationRule: {
    onReveal(state, loc, api) {
      while (state.encounterDeck.length) {
        const drawn = state.encounterDeck.pop()
        if (state.scenario.enemies[drawn]) { api.spawn(drawn, loc.id); break }
        state.encounterDiscard.push(drawn)
      }
    },
  },
}
