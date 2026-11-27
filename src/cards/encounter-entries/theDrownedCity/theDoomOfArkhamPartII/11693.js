// 11693 商业区（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：商业区（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined / flood.js（flags.ruined 与 floodBounds）。
export default {
  code: '11693',
  scope: 'location',
  implemented: true,
  flags: {
    ruined: true,
    enemyEntryReaction: { trait: 'Star Spawn', resourceCost: 3, effect: 'autoEvade' },
  },
  note: '星之眷族进入时，同地点调查员可支付 3 资源自动躲避。读点为本章敌人进入地点的反应。',
  abilities: [],
}
