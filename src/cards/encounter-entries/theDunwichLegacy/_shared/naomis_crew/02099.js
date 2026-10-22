// 02099 紧追不舍
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：naomis_crew
// 卡面：显现 - 如果场上没有未与调查员交战的[[罪犯]]敌人，紧追不舍获得涌动。如果场上有未与调查员交战的[[罪犯]]敌人，这些敌人各朝你移动1个地点。每个以此效果与你交战的[[罪犯]]敌人立刻进行一次攻击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02099', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const enemies = state.enemies.filter(enemy => enemy.engagedSeat == null && enemy.traits?.includes('Criminal'))
    if (!enemies.length) api.drawEncounter(inv.seat)
    for (const enemy of enemies) {
      api.moveEnemy(enemy, api.stepToward(enemy.location, inv.location))
      if (enemy.engagedSeat === inv.seat) api.attack(enemy, inv)
    }
    return false
  },
}
