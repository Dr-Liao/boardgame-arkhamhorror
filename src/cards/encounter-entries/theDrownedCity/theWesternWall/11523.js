// 11523 险恶道路 · Precarious Climb（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       强制 - 你进入险恶道路后：检定[willpower](X)。如果你失败，受到 1 点恐惧并提高本地点的淹没等级。
// 背面：如果你所在地点有线索，你不能进入险恶道路。
// 印刷：shroud = 层级（X）、每调查员 1 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.locationEntered 读 flags.enterTest（skill=willpower、failHorror、increaseFlood）。
export default {
  code: '11523',
  scope: 'location',
  implemented: true,
  flags: {
    treacherousPath: true,
    cannotEnterFromClues: true,
    enterTest: { skill: 'willpower', difficultyPerLevel: 1, failHorror: 1, increaseFlood: true },
  },
  note: '数据型条目：进入检定与失败后果由 behavior.locationEntered/runEnterTest 实现。',
  abilities: [],
}
