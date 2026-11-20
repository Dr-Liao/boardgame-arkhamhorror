// 11527 淹没棚屋 · 地点（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       当一名[[深潜者]]敌人移动时，淹没棚屋视为与每处其他完全淹没的地点相连，反之亦然。
// 印刷：shroud = 层级（X）、每调查员 2 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.enemyConnections（turn.js/movement.js 既有 enemyConnections 钩子）：
//       移动中的敌人带 [[Deep One]] 特性时，淹没棚屋与每处完全淹没地点按印刷双向互连（不改存档连接）。
export default {
  code: '11527',
  scope: 'location',
  implemented: true,
  flags: { treacherousPath: true, cannotEnterFromClues: true, shroudIsLevel: true, deepOneMovingConnectsFlooded: true },
  note: '「深潜者敌人移动时与完全淹没地点双向互连」由 behavior.enemyConnections（turn.js/movement.js 既有钩子）实现；'
    + '不再是场上有深潜者就持续并连（syncShantyConnections 只维护按行常规连接）。',
  abilities: [],
}
