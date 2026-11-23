// 11524 险恶道路 · Deadly Pass（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       强制 - 你进入险恶道路后：检定[willpower](X)。如果你失败，提高本地点的淹没等级。
//       如果本地点的淹没等级无法提高，改为选择并弃掉你控制的一张[[盟友]]支援。
// 背面：如果你所在地点有线索，你不能进入险恶道路。
// 印刷：shroud = 层级（X）、每调查员 1 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.locationEntered 读 flags.enterTest（increaseFlood/discardAllyIfNoFlood）。
export default {
  code: '11524',
  scope: 'location',
  implemented: true,
  flags: {
    treacherousPath: true,
    cannotEnterFromClues: true,
    enterTest: { skill: 'willpower', difficultyPerLevel: 1, increaseFlood: true, discardAllyIfNoFlood: true },
  },
  note: '数据型条目：进入检定与「淹没无法提高则弃盟友」由 behavior.locationEntered/runEnterTest 实现；'
    + '无法提高淹没时用 api.choose 让玩家选择自己控制的一张[[盟友]]支援，再经 api.discardAsset 弃置。',
  abilities: [],
}
