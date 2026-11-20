// 11604 碑匾腔室（已解封）/ 封印腔室 · 地点（不能被淹没；未解封不能进入；最后一个线索后发现并交付潮汐碑匾）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：behavior.moveError（未揭示/封印时不能进入）、behavior.afterInvestigate（碑匾交付）、
//       behavior.translateGlyph → maybeUnsealSealedChamber（翻译 3 符文后解封）。
export default {
  code: '11604',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"max":0}},
  flags: {"cannotBeFlooded":true,"cannotEnterWhileUnrevealed":true,"unsealAtGlyphs":3},
  note: "数据型条目：地点数值取卡表；进入限制、解封与碑匾交付均在 behavior。",
  abilities: [],
}
