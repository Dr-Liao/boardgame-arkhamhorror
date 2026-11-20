// 11701 克苏鲁 · 古老邪恶 · 克苏鲁敌人（多部位）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 克苏鲁本体：庞大数据面板，共享特性/文本框/地点；本身不作为攻击/躲避目标（由 3 张部位承担）。
// 读点：behavior.setupCthulhuBoard / linkCthulhuParts（多部位原语 linkEnemyParts）；
//       behavior.enemyStatModifier（战斗/躲避/生命 = 狂怒值；flags.cthulhuFacet）；
//       behavior.returnCthulhuFacetsToBoard（胜利区回面板 / 翻至狂怒面）。
// 印刷关键词：庞大、巡逻（最近的可淹没地点）、不能进行趁乱攻击。
//   · 巡逻：enemyRule.patrolTarget = { kind:'flood', canIncrease:true }（turn.js#patrolMove /
//     enemy-keyword-movement.js#resolvePatrol）；11706/11707 的「额外执行一次巡逻」经
//     api.runEnemyPatrol 再走同一实现，并记录 enemy.lastPatrolRound。
//   · 不能进行趁乱攻击：behavior.canOpportunityAttack（hidden-rules.js 读点）。
export default {
  code: '11701',
  scope: 'enemy',
  implemented: true,
  enemyRule: { patrolTarget: { kind: 'flood', canIncrease: true } },
  note: '本体数据 + 多部位/狂怒修正读点（见文件头）；巡逻目标 enemyRule.patrolTarget {kind:flood,canIncrease}；不能进行趁乱攻击走 behavior.canOpportunityAttack。',
  abilities: [],
}
