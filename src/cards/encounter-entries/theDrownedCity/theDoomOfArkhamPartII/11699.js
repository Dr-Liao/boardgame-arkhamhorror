// 11699 西侧屋顶 · 地点（[[屋顶]]）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：不能被淹没，且不能在其上放置印记；与指定 3 处地点相连（见 definition 连接表）；
//       位于本地点时可以如同位于连接地点般攻击/躲避该地点的敌人。
// 印刷：shroud 3 / 线索 1；特性 [[Arkham]][[Rooftop]]。
// 读点：locationRule.floodBounds（淹没上限 0，引擎 flood.js）；behavior.isRooftop（禁印记）；
//       flags.rooftop 由 behavior 读取。approximation：「如同位于连接地点攻击/躲避」未接线。
export default {
  code: '11699',
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 0 } },
  flags: { rooftop: true },
  note: '数据型条目：淹没上限与禁印记已接线；远程攻击/躲避为近似未实现项。',
  abilities: [],
}
