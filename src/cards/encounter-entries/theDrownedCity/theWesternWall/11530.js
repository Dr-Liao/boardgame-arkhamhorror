// 11530 西墙 · 地点（西墙，西线起始 / 东线终点）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       [action][action]：抽取 3 张卡牌。（每场游戏限一次。）
// 印刷：shroud = 层级（X）、每调查员 2 条线索、特性 [[R'lyeh]]。
// 读点：behavior.actions/performAction 的 twwWesternWallDraw 读 flags.doubleActionDraw，
//       每场一次标记在 behavior（state.scenarioFlags.twwWesternWallDrew）。
export default {
  code: '11530',
  scope: 'location',
  implemented: true,
  flags: { doubleActionDraw: 3 },
  note: '数据型条目：「两个行动抽 3 张」由 behavior 的 actions（actions: 2）实现，每场游戏限一次。',
  abilities: [],
}
