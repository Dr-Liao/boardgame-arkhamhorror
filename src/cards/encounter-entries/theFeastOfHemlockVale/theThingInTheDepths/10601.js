// 10601 鳄龟混种 · 敌人（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[生物]]。[[植物]]。[[突变]]。[[精英]]。胜利 0。
//   冷漠。逃逸。巡逻（最近的无人地点）。
//   如果鳄龟混种所在地点有重整状态的[[异形]]敌人，或如果鳄龟混种与调查员交战，它不能移动。
//   强制 - 如果本敌人被击败，（→结局 3）。
//
// 行为接线：enemyRule.patrolTarget = 最近的无人地点（引擎 resolvePatrol 读点）；
// behavior.refreshHybridImmovable 在入场/移动/交战/敌军阶段开始时刷新引擎的 `enemy.immobile`
// （巡逻/猎手/逃逸移动与 movement.js 共用该读点）；behavior.enemyDefeated → 结局 3。
export default {
  code: '10601',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    elusive: true,
    patrolTarget: { kind: 'nearestEmpty' },
  },
  flags: {
    elite: true, victory: 0,
    traits: ['Creature', 'Flora', 'Mutated', 'Elite'],
    aloof: true, elusive: true, patrol: 'nearestEmptyLocation',
    cannotMoveWhileReadyAbominationHereOrEngaged: true,
    defeatResolution: 'resolution3',
  },
  note: '「不能移动」用引擎既有的 enemy.immobile 读点近似（在入场/移动/交战/敌军阶段钩子里按条件刷新）。',
}
