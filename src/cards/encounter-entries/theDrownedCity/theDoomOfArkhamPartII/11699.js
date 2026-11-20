// 11699 西侧屋顶 · 地点（[[屋顶]]）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：不能被淹没，且不能在其上放置印记；与指定 3 处地点相连（见 definition 连接表）；
//       位于本地点时可以如同位于连接地点般攻击/躲避该地点的敌人。
// 印刷：shroud 3 / 线索 1；特性 [[Arkham]][[Rooftop]]。
// 读点（第二轮已接）：locationRule.floodBounds（淹没上限 0，引擎 flood.js）；
//   locationRule.reachConnectingEnemies（moves.js 目标枚举：位于本地点可攻击/躲避直接相连地点的敌人）；
//   behavior.isRooftop（禁印记）；flags.rooftop 由 behavior 读取。[fast] 进入费用为印刷数值，未改。
export default {
  code: '11699',
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 0 }, reachConnectingEnemies: true },
  flags: { rooftop: true },
  note: '数据型条目：淹没上限 / 禁印记 / 从屋顶攻击或躲避连接地点敌人均已接线（flood.js / moves.js 读点）。',
  abilities: [],
}
