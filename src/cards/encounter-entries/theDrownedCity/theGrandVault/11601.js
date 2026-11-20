// 11601 异界机械（闸门控制）· 地点（揭示时抽 1 张放在一边的[[符文]]诡计；1 伤害 + 1 恐惧激活）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
export default {
  code: '11601',
  scope: 'location',
  implemented: true,
  flags: {"revealGlyphTreachery":true,"activationCost":"damageHorror"},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
