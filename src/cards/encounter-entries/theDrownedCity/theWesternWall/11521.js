// 11521 险恶道路 · Slick Steps（西墙，×2）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       强制 - 你从本地点上方的地点进入险恶道路后：受到 1 点伤害。
//       强制 - 你从本地点下方的地点进入险恶道路后：受到 1 点恐惧。
// 背面：如果你所在地点有线索，你不能进入险恶道路。
// 印刷：shroud = 层级（X）、每调查员 1 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.beforeMove 读 flags.cannotEnterFromClues；behavior.locationEntered 读
//       flags.treacherousPath/enterFromAbove/enterFromBelow；shroud=层级由 behavior.locationPlaced 写。
export default {
  code: '11521',
  scope: 'location',
  implemented: true,
  flags: {
    treacherousPath: true, cannotEnterFromClues: true, shroudIsLevel: true,
    enterFromAbove: { damage: 1 }, enterFromBelow: { horror: 1 },
  },
  note: '数据型条目：shroud=层级与进出方向效果由 behavior.locationPlaced/locationEntered 实现。',
  abilities: [],
}
