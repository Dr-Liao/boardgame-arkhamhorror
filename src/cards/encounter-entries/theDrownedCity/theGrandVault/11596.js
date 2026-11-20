// 11596 隐蔽蓄水池 · 地点 ×2（本地点的淹没等级不能降低；揭示后提高其淹没等级；
//       [action] 激活本地点并提高一处符合条件的[[秘库]]地点淹没等级）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点（双层约束）：
//   · 引擎侧：locationRule.floodBounds.min = 1 —— 任何水位写入（含 api.mechanics.water.change 等
//     直接路径）都把降低钳制在 1，配合「揭示后强制提高」使实际水位恒 ≥1；
//   · 内容侧：locationRule.cannotDecreaseFlood = true —— behavior.decreaseFloodLevel 先读该声明并拒绝
//     降低调用（覆盖未揭示/水位 0 的边界，避免 min 钳制把「降低」变成提高）。
export default {
  code: '11596',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"min":1},"cannotDecreaseFlood":true},
  flags: {"revealFlood":true,"activationCost":"cistern"},
  note: "「淹没等级不能降低」= locationRule.floodBounds.min 1（引擎水位写入钳制）+ locationRule.cannotDecreaseFlood（behavior.decreaseFloodLevel 拒绝）；揭示后强制提高由 behavior.locationRevealed。",
  abilities: [],
}
