// 11628 荧光档案库（历史档案库）· 地点（每张其上/附属的[[符文]] +1 隐藏值；[fast] 花 X 行动搜弃牌堆符文；[action] 移动到[[通道]]地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：搜索弃牌堆与[[通道]]移动未接线；隐藏值修正在 behavior.locationShroudModifier。
export default {
  code: '11628',
  scope: 'location',
  implemented: true,
  flags: {"passageway":true,"shroudPerAttachedGlyph":1},
  note: "approximation：搜索弃牌堆与[[通道]]移动未接线；隐藏值修正在 behavior.locationShroudModifier。",
  abilities: [],
}
