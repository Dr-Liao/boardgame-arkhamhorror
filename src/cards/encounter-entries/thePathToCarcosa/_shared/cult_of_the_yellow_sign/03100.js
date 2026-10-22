// 03100 王之法令
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：cult_of_the_yellow_sign
// 卡面：显现 - 场上每有1个[[异教徒]]敌人，就将该敌人所在地点的1个线索移动到该敌人上。直到一轮结束，对于场上每个[[异教徒]]敌人，该敌人上每有1个线索和/或毁灭标记，就使其得到+1攻击。如果没有因本效果移动的线索，王之法令获得涌动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03100', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    let moved = 0
    for (const enemy of state.enemies.filter(enemy => enemy.traits?.includes('Cultist'))) {
      const location = state.locations.find(candidate => candidate.id === enemy.location)
      if (location?.clues) {
        location.clues--
        enemy.clues = (enemy.clues || 0) + 1
        moved++
      }
      enemy.kingsEdictRound = state.round
    }
    if (!moved) api.drawEncounter(inv.seat)
    return false
  },
}
