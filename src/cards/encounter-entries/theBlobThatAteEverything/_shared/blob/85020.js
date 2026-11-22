// 85020 · 吞噬万物（theBlobThatAteEverything）
// 归属：关卡专用 · theBlobThatAteEverything/theBlobThatAteEverything。

export default {
  code: '85020',
  scope: 'location',
  implemented: true,
  note: "干枯农田（Desiccated Farmland）：地点行动/被动在 behavior.actions/performAction 与对应强制钩子里结算（本关地点能力统一走场景行动，条目只登记归属）。在此不能获得资源（behavior.canGainResources）；回合结束时失去 1 资源（behavior.turnEnded）。",
  abilities: [],
}
