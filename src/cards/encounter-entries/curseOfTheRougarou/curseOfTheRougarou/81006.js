// 81006 · 狼人诅咒（curseOfTheRougarou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
export default {
  code: '81006',
  scope: 'act',
  implemented: true,
  flags: {"actIndex":2,"tameAdvance":true},
  note: "目标由 behavior.checkObjectives（狼人被击败→结局 2）与 behavior.actions/performAction 的 rougarouTameAdvance（与狼人交战时可推进，4 项条件满足→结局 3，否则翻回 2a）结算；「狼人离开地点后放 1 线索」在 behavior 的移动副作用中结算。",
  abilities: [],
}
