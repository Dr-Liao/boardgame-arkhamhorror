// 03146 邪教的搜查
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：显现 - 如果场上有带有毁灭标记的[[异教徒]]敌人，将每个[[异教徒]]敌人上的所有毁灭标记移动到当前密谋上(本效果可以导致当前密谋推进)。如果场上没有带有毁灭标记的[[异教徒]]敌人，查找遭遇牌库和遭遇弃牌堆，找出一个[[异教徒]]敌人并将其抽取(混洗遭遇牌库)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 追随者找到前路（03146）：带毁灭的异教徒把毁灭转移到当前议程；否则从遭遇牌库找出一个异教徒。

export default {
  code: '03146', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const cultists = (state.enemies || []).filter(enemy =>
      enemy.traits?.includes('Cultist') && (enemy.doom || 0) > 0)
    if (cultists.length) {
      let moved = 0
      for (const enemy of cultists) {
        moved += enemy.doom || 0
        enemy.doom = 0
      }
      // 毁灭搬到密谋上后立即检查推进。
      if (moved) api.addDoom(moved)
    } else {
      // 卡面：遭遇牌库和遭遇弃牌堆都可以查找（弃牌堆优先，最后抽出）。
      const piles = [state.encounterDeck, state.encounterDiscard]
      let enemyCode = null
      for (const pile of piles) {
        const index = (pile || []).findLastIndex(candidate =>
          state.scenario?.enemies?.[candidate]?.traits?.includes('Cultist'))
        if (index >= 0) {
          enemyCode = pile.splice(index, 1)[0]
          break
        }
      }
      if (enemyCode) {
        api.spawn(enemyCode, inv.location)
        api.shuffleEncounterDeck()
      }
    }
    return false
  },
}
