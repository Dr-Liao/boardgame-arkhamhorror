// 11697 圣玛丽医院（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：圣玛丽医院（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 印刷限制：不能完全淹没（水位上限 1，locationRule.floodBounds 引擎读点）。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined / flood.js（flags.ruined 与 floodBounds）。
export default {
  code: '11697',
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 1 } },
  flags: {
    ruined: true,
    enemyEntryReaction: { trait: 'Cthulhu', enemyCode: '11701', maxClues: 3, groupLimit: 'perGame', effect: 'damagePerClue' },
  },
  note: '克苏鲁进入后，将最多 3 个线索放在本地点，并为每个线索选择在场敌人造成伤害。读点为本章敌人进入地点的反应。',
  abilities: [],
}
