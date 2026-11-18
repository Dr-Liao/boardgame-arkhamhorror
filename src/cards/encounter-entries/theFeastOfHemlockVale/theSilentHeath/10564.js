// 10564 族群兵虫 · 敌人（寂静荒野，×3）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：冷漠。巡逻（有线索的[[洞穴]]地点）。
//       族群兵虫为重整状态时，其地点得到 +2 隐藏值。
// 印刷：战斗 3 / 躲避 3 / 生命 2 / 伤害 1 / 恐惧 1 / 特性 [[Creature]][[Insect]][[Mutated]] / 胜利 0。
// 读点：巡逻目标走条目 enemyRule.patrolTarget（引擎 turn.js#patrolMove → resolvePatrol 的唯一读点）；
//       +2 隐藏值走 behavior.locationShroudModifier 的 readyShroudBonus。
export default {
  code: '10564',
  scope: 'enemy',
  implemented: true,
  enemyRule: { patrolTarget: { kind: 'trait', trait: 'Cave', minClues: 1 } },
  flags: { broodSoldier: true, readyShroudBonus: 2 },
  note: '数据型条目：数值取卡表；巡逻目标与 shroud 修正在 behavior。',
}
