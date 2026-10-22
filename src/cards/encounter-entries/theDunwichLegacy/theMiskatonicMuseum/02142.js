// 02142 暗影之子
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：如果追猎恐魔进入混沌，暗影之子依然保留附属。
// 卡面：暗影之子上每有1资源，追猎恐魔得到+1攻击，+1生命，+1躲避。如果暗影之子上有至少3资源，追猎恐魔也获得庞大。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：敦威治后段章节的遭遇显现规则从 later-behaviors.js 搬来。
// 每张卡只声明自己的显现结算；章节入口仍由 later-behaviors.resolveEncounter 分派。

export default {
  code: '02142', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const horror = state.enemies.find(enemy => enemy.code === '02141')
    if (horror) horror.shadowSpawned = true
    return true
  },
}
