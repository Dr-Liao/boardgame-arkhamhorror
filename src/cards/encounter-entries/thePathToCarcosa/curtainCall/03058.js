// 03058 机关室
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：强制 - 在你揭示机关室后：查找遭遇牌库和遭遇弃牌堆，找出1张鼠群并将其放置入场与你交战(如果游戏中有3或4位调查员，改为2张)。如果查找过遭遇牌库，将其混洗。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 94 轮：谢幕的群鼠后台。

export default {
  code: '03058', scope: 'location',
  locationRule: {
    onReveal(state, location, api) {
      const copies = state.numInvestigators >= 3 ? 2 : 1
      for (let count = 0; count < copies; count++) {
        let found = false
        for (const pile of [state.encounterDeck, state.encounterDiscard]) {
          const index = pile.findIndex(code => code === 'swarmOfRats' || code === '01159')
          if (index < 0) continue
          const enemy = api.spawn(pile.splice(index, 1)[0], location.id)
          if (enemy) api.engage(enemy, state.currentSeat)
          found = true
          break
        }
        if (!found) break
      }
      api.shuffleEncounterDeck()
    },
  },
}
