// 11595 秘库核心 · 地点（不能被淹没；未揭示不能进入；轮末每处[[秘库]]已激活则解封；幕间「秘库核心」；
//       强制 - 穷途异魔在本地点被击败时移出所有「仍在你身后」并记录该生物被击败了）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：behavior.moveError（未揭示不能进入）、behavior.enemyDefeated（穷途异魔在本地点被击败）、
//       behavior.maybeRevealCore / roundEnded（解封）、behavior.vaultCoreInterlude（幕间）。
export default {
  code: '11595',
  scope: 'location',
  implemented: true,
  locationRule: {"floodBounds":{"max":0}},
  flags: {"cannotBeFlooded":true,"cannotEnterWhileUnrevealed":true,"vaultCoreInterlude":true},
  note: "数据型条目：地点数值取卡表；不能进入/被击败强制/解封/幕间读点均在 behavior。",
  abilities: [],
}
