// 11670 · enemy · obsidianCanyons
//
// 原初恐怖（×3）。巡逻（最近的空[[峰顶]]地点）；不能进行趁乱攻击；与你交战时你可如地点般进入开阔天空；在开阔天空击败或解除交战时你被击败并受 1 肉体创伤。行为读点：behavior.movementError（交战时可进开阔天空）、behavior.enemyAttackResolved（开阔天空触发）。巡逻/空位选择为引擎声明（enemyRule 未接线，近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11670',
  scope: 'enemy',
  implemented: true,
  flags: { patrol: 'nearestEmptySummit', noOpportunityAttack: true, openSkyWhileEngaged: true },
  
  note: "原初恐怖（×3）。巡逻（最近的空[[峰顶]]地点）；不能进行趁乱攻击；与你交战时你可如地点般进入开阔天空；在开阔天空击败或解除交战时你被击败并受 1 肉体创伤。行为读点：behavior.movementError（交战时可进开阔天空）、behavior.enemyAttackResolved（开阔天空触发）。巡逻/空位选择为引擎声明（enemyRule 未接线，近似）。",
}
