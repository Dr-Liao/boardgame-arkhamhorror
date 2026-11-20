// 11534 “小心！” · 诡计 ×3（西墙）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：显现 - 检定[intellect](3)。如果你失败，将“小心！”放置入场，位于你的威胁区。
//       强制 - 每轮中，你首次进入一处淹没地点后：受到 1 点恐惧。
//       强制 - 你的回合结束时：检定[agility](3)。如果你成功，弃掉“小心！”。
// 印刷：特性 [[Terror]]。
// 读点（全部为引擎既有读点）：
//   · 显现：encounterResolve → api.test(intellect,3) 失败时 api.threat(seat, '11534')（威胁区唯一写入口）；
//   · 进入淹没地点：behavior.locationEntered → triggerLookOutOnEnter（读 flags.enterFloodedHorror，
//     每 seat+round 只触发一次，state.scenarioFlags.twwLookOutRounds 记录）；
//   · 回合结束：条目声明 threatEffect.endTurnTest，由 turn.js#runThreatEndTurn 的既有读点检定并弃卡。
export default {
  code: '11534',
  scope: 'treachery',
  implemented: true,
  flags: { enterFloodedHorror: 1 },
  treacheryRule: { threatArea: true },
  threatEffect: { endTurnTest: { skill: 'agility', difficulty: 3 } },
  encounterResolve(state, inv, card, api) {
    if (!inv) return false
    if (typeof api?.test !== 'function') return false
    api.test(inv.seat, 'intellect', 3, result => {
      if (result?.success) return
      if (typeof api?.threat === 'function') api.threat(inv.seat, '11534')
      else api?.info?.('「小心！」检定失败，但当前上下文缺少 api.threat，未放入威胁区。')
    })
    return true
  },
  note: '印刷行为已接到既有读点（encounterResolve + behavior.locationEntered + 引擎 threatEffect.endTurnTest）。'
    + '进入淹没地点的覆盖：引擎所有位移入口（relocateInvestigator：卡牌/效果移动、载具、战斗推开、'
    + '地点移出改道 removeLocation）都会调用 behavior.locationEntered；theWesternWall 章节内没有直接写 '
    + 'inv.location 的路径（开局落位不算「进入」），故全部进入路径都覆盖。'
    + '「首次」按 seat+round 记录，跨回合按轮次键自然区分。',
  abilities: [],
}
