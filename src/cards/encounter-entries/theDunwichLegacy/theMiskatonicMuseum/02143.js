// 02143 暗影潜随
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：显现 - 如果追猎恐魔在场上，其重整，与你交战，并攻击你所在地点的每位调查员。否则，暗影潜随获得涌动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02143', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const horror = state.enemies.find(enemy => enemy.code === '02141')
    if (!horror) { api.drawEncounter(inv.seat); return false }
    horror.exhausted = false
    // 印刷能力只让它在原地准备并交战，不会跨博物馆传送。
    if (horror.location === inv.location) {
      api.engage(horror, inv.seat)
      for (const target of state.investigators.filter(other =>
        !other.defeated && !other.resigned && other.location === inv.location)) api.attack(horror, target)
    }
    return false
  },
}
