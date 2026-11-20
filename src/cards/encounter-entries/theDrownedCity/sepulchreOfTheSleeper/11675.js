// 11675 · agenda · sepulchreOfTheSleeper
//
// 议程 2（克苏鲁苏醒）。强制：本密谋被放置毁灭时每位调查员受 1 直接恐惧（behavior.doomPlaced）；[fast] 从你控制的神器移除 1 毁灭 → 克苏鲁本轮失去无情且 -1 战斗/-1 躲避（behavior.weakenCthulhu）。目标：击败克苏鲁 → 结局 1；背面「你无法逃避的毁灭」→ 每位存活调查员发疯、战役失败（behavior.agendaReveal）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11675',
  scope: 'agenda',
  implemented: true,
  flags: { agenda: 'cthulhuAwakened', doomThreshold: 100, doomPlacementHorror: 1, weakenCthulhu: true, backEffect: 'inevitableDoom' },
  
  note: "议程 2（克苏鲁苏醒）。强制：本密谋被放置毁灭时每位调查员受 1 直接恐惧（behavior.doomPlaced）；[fast] 从你控制的神器移除 1 毁灭 → 克苏鲁本轮失去无情且 -1 战斗/-1 躲避（behavior.weakenCthulhu）。目标：击败克苏鲁 → 结局 1；背面「你无法逃避的毁灭」→ 每位存活调查员发疯、战役失败（behavior.agendaReveal）。",
}
