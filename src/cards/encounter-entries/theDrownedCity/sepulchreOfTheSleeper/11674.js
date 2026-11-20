// 11674 · agenda · sepulchreOfTheSleeper
//
// 议程 1（替代幕/议程牌库）。强制：非剧情支援卡将要放毁灭时改为 +1 扰动；扰动 ≥6（1-2 名调查员改为 8）立刻推进。
// 「不移除场上卡牌上的毁灭标记」由 doomKeptOnAgendaAdvance:'storyAssets'（引擎 clearDoomInPlay 读点）+ behavior.agendaAdvancing（推进前快照神器毁灭）/ restoreArtifactDoom（推进后回填）共同消费。
// 目标：为最终对决准备你的神器。读点：behavior.canPlaceDoomOn / maybeAdvanceBeneathTheCity / agendaAdvancing / agendaReveal（生成克苏鲁）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11674',
  scope: 'agenda',
  implemented: true,
  // 印刷：「立刻推进（不移除场上卡牌上的毁灭标记）」——保留场上神器（剧情资产）上的毁灭。
  doomKeptOnAgendaAdvance: 'storyAssets',
  flags: { agenda: 'beneathTheCity', doomReplacement: 'disturbance', advanceSpawns: '11674b', threshold: 6, thresholdSmallParty: 8 },
  
  note: "议程 1（替代幕/议程牌库）。强制：非剧情支援卡将要放毁灭时改为 +1 扰动（behavior.canPlaceDoomOn）；扰动 ≥6（1-2 名调查员改为 8）立刻推进（behavior.maybeAdvanceBeneathTheCity）；推进时 doomKeptOnAgendaAdvance:'storyAssets' + behavior.agendaAdvancing/restoreArtifactDoom 保留神器上的毁灭、其他卡按规则清空；背面生成克苏鲁（behavior.agendaReveal）。目标「为最终对决准备神器」为叙事目标。",
}
