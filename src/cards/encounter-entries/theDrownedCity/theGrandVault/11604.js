// 11604 碑匾腔室（已解封）/ 封印腔室 · 地点（不能被淹没；未解封不能进入；最后一个线索后交付潮汐碑匾）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
export default {
  code: '11604',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"max":0}},
  flags: {"cannotBeFlooded":true,"cannotEnterWhileUnrevealed":true,"unsealAtGlyphs":3},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
