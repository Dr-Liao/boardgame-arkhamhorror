// 11600 异界机械（黑曜壁垒）· 地点（揭示时抽 1 张放在一边的[[符文]]诡计；弃 3 张手牌激活）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
export default {
  code: '11600',
  scope: 'location',
  implemented: true,
  flags: {"revealGlyphTreachery":true,"activationCost":"discard3"},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
