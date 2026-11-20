// 11603 异界机械（难解装置）· 地点（揭示时抽 1 张放在一边的[[符文]]诡计；揭示牌库顶 3 张激活）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
export default {
  code: '11603',
  scope: 'location',
  implemented: true,
  flags: {"revealGlyphTreachery":true,"activationCost":"revealTop3"},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
