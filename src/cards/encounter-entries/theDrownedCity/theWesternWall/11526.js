// 11526 沉没阶梯 · 地点（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：X 为本地点的层级。
//       强制 - 沉没阶梯被揭示后：将放在一边的水下秘库[tdc_rune_z]地点放置入场，
//       位于沉没阶梯上方或下方的一行。
// 印刷：shroud = 层级（X）、每调查员 2 条线索、特性 [[R'lyeh]][[Walkway]]。
// 读点：behavior.locationRevealed 读 flags.revealUnderseaVault（选择上/下空行并放置 11532）。
export default {
  code: '11526',
  scope: 'location',
  implemented: true,
  flags: { treacherousPath: true, cannotEnterFromClues: true, shroudIsLevel: true, revealUnderseaVault: true },
  note: '数据型条目：揭示时放置水下秘库由 behavior.locationRevealed 实现（上/下由玩家选择空行）。',
  abilities: [],
}
