// 11525 险恶道路 · Shallow Den（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       强制 - 险恶道路被揭示后：将放到一边的珊瑚星之眷族敌人以横置状态生成在本地点。
//       其在下个补给阶段不能重整。
// 背面：如果你所在地点有线索，你不能进入险恶道路。
// 印刷：shroud = 层级（X）、每调查员 1 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.locationRevealed 读 flags.spawnCoralStarSpawnOnReveal（珊瑚星之眷族 = 11727，放一边）。
export default {
  code: '11525',
  scope: 'location',
  implemented: true,
  flags: {
    treacherousPath: true, cannotEnterFromClues: true, shroudIsLevel: true,
    spawnCoralStarSpawnOnReveal: true, coralStarSpawnCode: '11727',
  },
  note: '数据型条目：揭示时生成横置的珊瑚星之眷族由 behavior.locationRevealed 实现。'
    + 'approximation：「下个补给阶段不能重整」没有通用敌人读点，只记录 enemy.doesNotReadyDuringUpkeep 等 Lead/引擎补读点。',
  abilities: [],
}
