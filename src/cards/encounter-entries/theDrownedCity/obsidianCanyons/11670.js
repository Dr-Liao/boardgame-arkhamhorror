// 11670 · enemy · obsidianCanyons
//
// 原初恐怖（×3）。巡逻（最近的空[[峰顶]]地点）由 enemyRule.patrolTarget {kind:'nearestEmptyTrait', trait:'Summit'} 接线（引擎 turn.js#patrolMove/enemy-keyword-movement.js#resolvePatrol）；不能进行趁乱攻击由 behavior.canOpportunityAttack（hidden-rules.js#enemyCanOpportunityAttack 读点）返回 false；与你交战时你可如地点般进入开阔天空（behavior.movementError）；在开阔天空被击败 → 交战调查员被击败 +1 肉体创伤（behavior.enemyDefeated）。「位于开阔天空时解除交战 → 被击败并 +1 肉体创伤」由 behavior.enemyDisengaged（enemies.js#disengageEnemy 读点）消费。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11670',
  scope: 'enemy',
  implemented: true,
  // 印刷「巡逻（最近的空[[峰顶]]地点）」：引擎 enemy-keyword-movement.js 的 nearestEmptyTrait 读点。
  enemyRule: { patrolTarget: { kind: 'nearestEmptyTrait', trait: 'Summit' } },
  flags: { patrol: 'nearestEmptySummit', noOpportunityAttack: true, openSkyWhileEngaged: true },
  
  note: "原初恐怖（×3）。巡逻（最近的空[[峰顶]]地点）由 enemyRule.patrolTarget {kind:'nearestEmptyTrait', trait:'Summit'} 接线（turn.js#patrolMove / enemy-keyword-movement.js#resolvePatrol）；不能进行趁乱攻击由 behavior.canOpportunityAttack（hidden-rules.js#enemyCanOpportunityAttack 读点）返回 false；与你交战时你可如地点般进入开阔天空（behavior.movementError）；在开阔天空被击败 → 交战调查员被击败 +1 肉体创伤（behavior.enemyDefeated）。「解除交战时」无引擎钩子（下轮补），近似保留。",
}
