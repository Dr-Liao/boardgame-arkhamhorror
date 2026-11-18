// 10590 沼地之物 · 议程 2（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：毁灭阈值 10。
//   强制 - 在你的回合结束时，如果你在[[沼地]]地点：放置 1 个伤害标记，作为渗坑
//          （1 或 2 位调查员时改为 2 个）；3 个或更多渗坑的地点移除全部渗坑并翻面。
//   目标 - 如果深沼之物被击败，（→结局 4）。
// 背面（险成一餐）：幸存的每位调查员被击败并承受 1 点肉体创伤。
//
// 目标「深沼之物被击败 → 结局 4」由 behavior.enemyDefeated 承接；背面由 behavior.agendaReveal。
export default {
  code: '10590',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 10,
    forcedTurnEndSinkhole: { perInvestigatorThreshold: 2, sinkholesAtOneOrTwoInvestigators: 2, sinkholesOtherwise: 1 },
    forcedFlipAtThreeSinkholes: true,
    objective: { type: 'thingInTheDepthsDefeated', resolution: 'resolution4' },
    back: 'defeatSurvivingInvestigatorsAndPhysicalTrauma',
  },
  note: '数据型议程条目：目标与背面规则在 definition.js 与 behavior（enemyDefeated / agendaReveal）。',
  abilities: [],
}
