// 81029 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81029',
  scope: 'treachery',
  implemented: true,
  flags: {"weaknessInThreat":true},
  note: "显现后进入队长（或持有者）威胁区域由 definition.treacheries[code].threat=true 走通用分支；「回合结束未造成伤害则受 1 恐惧」由 behavior.turnEnded + behavior.enemyAttackedSuccessfully 的伤害记账结算。",
  abilities: [],
}
