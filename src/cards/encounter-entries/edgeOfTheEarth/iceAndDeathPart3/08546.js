// 08546 陷入围攻！· 幕 3
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart3（P7 亡命冰原 III）。
// 卡面：每个 [[幻灵]] 敌人获得胜利 0；营地获得「[action] 你所在地点的调查员共同花费 4 个线索：撤退」；
//       目标：场上没有幻灵敌人，或所有未被击败的调查员都已撤退 → 推进场景。
// 读点（全部在真实引擎路径上）：
//   · 幕目标 → behavior.actObjectiveMet / checkObjectives（act-agenda.js#checkLinearAct）；
//   · 营地撤退行动 → flags.campResign 由 behavior.actions / performAction 读取
//     （moves.js#legalMoves / dispatch.js#executeAction → scenarioBehavior.actions / performAction）；
//   · 背面结局 1/2 → behavior.actReveal（reveal.js#runActReveal）。
export default {
  code: '08546',
  scope: 'act',
  implemented: true,
  actRule: {},
  flags: { campResign: true },
}
