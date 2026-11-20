// 11527 淹没棚屋 · 地点（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       当一名[[深潜者]]敌人移动时，淹没棚屋视为与每处其他完全淹没的地点相连，反之亦然。
// 印刷：shroud = 层级（X）、每调查员 2 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.enemyMoved / syncShantyConnections 读 flags.deepOneMovingConnectsFlooded
//       （有深潜者敌人时把完全淹没地点加入连接；简化成持续相连，见 note）。
export default {
  code: '11527',
  scope: 'location',
  implemented: true,
  flags: { treacherousPath: true, cannotEnterFromClues: true, shroudIsLevel: true, deepOneMovingConnectsFlooded: true },
  note: 'approximation：印刷是「深潜者移动时」的瞬时连接；本实现按「场上有深潜者敌人」持续把'
    + '完全淹没地点加入淹没棚屋的连接（behavior.syncShantyConnections 在移动/布置/轮末重算）。',
  abilities: [],
}
