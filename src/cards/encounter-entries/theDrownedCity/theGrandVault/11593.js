// 11593 大阶梯 · 地点（起始地点，不能被淹没；[action] 撤退）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
export default {
  code: '11593',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"max":0}},
  flags: {"cannotBeFlooded":true,"resign":true},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
