// 81004 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81004',
  scope: 'agenda',
  implemented: true,
  flags: {"agendaIndex":3,"doomThreshold":8},
  note: "正面强制「调查阶段结束时狼人未与调查员交战→本议程 +1 毁灭」由 behavior.phaseBegan（神话阶段开始=调查阶段结束）读 flags.agendaIndex 结算；背面进入结局 1（behavior.agendaReveal）。",
  abilities: [],
}
