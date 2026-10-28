// 03100 王之法令
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：cult_of_the_yellow_sign
// 卡面：显现 - 场上每有1个[[异教徒]]敌人，就将该敌人所在地点的1个线索移动到该敌人上。直到一轮结束，对于场上每个[[异教徒]]敌人，该敌人上每有1个线索和/或毁灭标记，就使其得到+1攻击。如果没有因本效果移动的线索，王之法令获得涌动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 本轮常驻修正的读点：content/campaigns/thePathToCarcosa/encounter-rules.js 的
// `enemyStatModifier` 读下面的 `enemyStatRule.kingsEdict`（声明即接线），轮次由
// scenarioFlags.kingsEdictRound 标记；结算时写入，轮末由 encounter-rules.roundEnded 清理。

export default {
  code: '03100', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  // 数据：本轮内每个[[异教徒]]敌人每有 1 个线索/毁灭，战斗值 +1。
  enemyStatRule: {
    kingsEdict: { stat: 'fight', trait: 'Cultist', perMarkers: ['clues', 'doom'], amount: 1 },
  },
  encounterResolve(state, inv, card, api) {
    let moved = 0
    for (const enemy of state.enemies.filter(enemy => enemy.traits?.includes('Cultist'))) {
      // 线索来源是敌人所在地点（原语统一处理「往事回声」的线索翻毁灭面）。
      moved += api.moveClueToEnemy(enemy)
    }
    // 本轮内后入场的异教徒也要吃到 +1 攻击：记号是轮次，不是「进场时的快照」。
    api.setScenarioFlag('kingsEdictRound', state.round)
    if (!moved) api.drawEncounter(inv.seat)
    return false
  },
}
