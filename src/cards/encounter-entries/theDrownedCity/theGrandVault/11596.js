// 11596 隐蔽蓄水池 · 地点 ×2（揭示后提高淹没等级；[action] 激活并提高一处[[秘库]]的淹没等级）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 近似：approximation：印刷「淹没等级不能降低」用 floodBounds.min=1 表达——地点首次被提高后不能再降低，与印刷在揭示后才提高的实际顺序一致，但若在揭示前被效果降到 0 不会被阻止。
export default {
  code: '11596',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"min":1}},
  flags: {"revealFlood":true,"activationCost":"cistern"},
  note: "approximation：印刷「淹没等级不能降低」用 floodBounds.min=1 表达——地点首次被提高后不能再降低，与印刷在揭示后才提高的实际顺序一致，但若在揭示前被效果降到 0 不会被阻止。",
  abilities: [],
}
