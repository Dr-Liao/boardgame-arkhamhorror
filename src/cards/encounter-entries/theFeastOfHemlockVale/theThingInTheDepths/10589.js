// 10589 地表下沉 · 议程 1（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：毁灭阈值 3。
//   [action]：撤退。你逃出了沼地。
//   强制 - 在你的回合结束时，如果你在[[沼地]]地点：在你的地点放置 1 个伤害标记，作为渗坑
//          （如果游戏中只有 1 或 2 位调查员，改为 2 个渗坑）。
//   强制 - 如果一个地点上有 3 个或更多渗坑：将其所有的渗坑移除，并将其翻面。
// 背面（险些中伏）：将中央地点翻至[[沉没]]面，弃掉其所有标记和玩家卡牌附属。将放在一边的深沼之物敌人生成在此。
//
// 阶段数据（threshold/背面）由 definition.js 的 stage() 与 behavior.agendaReveal 承接；
// 回合结束渗坑与 3 渗坑翻面由 behavior.turnEnded/sinkLocationsAtThreshold 承接。数据型条目。
export default {
  code: '10589',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 3,
    forcedTurnEndSinkhole: { perInvestigatorThreshold: 2, sinkholesAtOneOrTwoInvestigators: 2, sinkholesOtherwise: 1 },
    forcedFlipAtThreeSinkholes: true,
    resignAction: true,
    back: 'flipCenterLocationAndSpawnThingInTheDepths',
  },
  note: '数据型议程条目：阈值/背面规则在 definition.js 与 behavior（turnEnded / agendaReveal）。',
  abilities: [],
}
