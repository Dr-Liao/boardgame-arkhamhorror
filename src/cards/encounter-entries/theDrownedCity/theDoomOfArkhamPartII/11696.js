// 11696 河岸城（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：河岸城（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined / flood.js（flags.ruined 与 floodBounds）。
export default {
  code: '11696',
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 2 } },
  flags: { ruined: true },
  note: '数据型条目：数值由 definition.location() 读卡表；废墟交换在 behavior.agendaReveal → swapToRuined。',
  abilities: [],
}
