// 11595 秘库核心 · 地点（不能被淹没；未揭示不能进入；轮末每处[[秘库]]已激活则解封；幕间「秘库核心」）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
export default {
  code: '11595',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"max":0}},
  flags: {"cannotBeFlooded":true,"cannotEnterWhileUnrevealed":true,"vaultCoreInterlude":true},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
