// 11522 险恶道路 · Eroded Shelf（西墙，×2）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       强制 - 你进入险恶道路后：检定[agility](X)。如果你失败，受到 1 点伤害并提高本地点的淹没等级。
// 背面：如果你所在地点有线索，你不能进入险恶道路。
// 印刷：shroud = 层级（X）、每调查员 1 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.locationEntered 读 flags.treacherousPath/enterTest（skill/difficultyPerLevel/failDamage/increaseFlood）。
export default {
  code: '11522',
  scope: 'location',
  implemented: true,
  flags: {
    treacherousPath: true,
    cannotEnterFromClues: true,
    enterTest: { skill: 'agility', difficultyPerLevel: 1, failDamage: 1, increaseFlood: true },
  },
  note: '数据型条目：进入检定（难度=层级）与失败后果由 behavior.locationEntered/runEnterTest 实现。',
  abilities: [],
}
