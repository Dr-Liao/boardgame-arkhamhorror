// 02146 尾随之蛇
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：显现 - 如果追猎恐魔在场上，为其增加1个毁灭标记。如果追猎恐魔不在场上，查找遭遇牌库、弃牌堆和混沌，找出追猎恐魔并将其生成在你所在地点，与你交战。混洗遭遇牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { summonHuntingHorror } from '../../_shared.js'

export default {
  code: '02146', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const horror = state.enemies.find(enemy => enemy.code === '02141')
    if (horror) horror.doom = (horror.doom || 0) + 1
    else {
      const spawned = summonHuntingHorror(state, inv.location, api)
      if (spawned) api.engage(spawned, inv.seat)
    }
    api.shuffleEncounterDeck()
    return false
  },
}
