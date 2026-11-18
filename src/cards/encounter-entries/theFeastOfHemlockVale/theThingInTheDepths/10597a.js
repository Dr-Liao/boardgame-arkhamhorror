// 10597a 废弃棚屋 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 2，每名调查员 2 条线索。
// [fast] 花费 1 个线索：将废弃棚屋的 1 个渗坑移到本地点的敌人身上，作为伤害。（每轮仅限一次。）
//
// 由 behavior.actions（rule 'depthsAbandonedShackDrain'）产出，performAction 结算；
// 每轮一次记在 scenarioFlags.depthsShackRound（引擎无通用「每轮一次」字段）。
export default {
  code: '10597a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2, printedCluesPerInvestigator: 2,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10597b',
    fastAction: { action: 'depthsAbandonedShackDrain', costClues: 1, limitPerRound: 1 },
  },
  note: '数据型地点条目；线索换渗坑伤害由 behavior.actions/performAction 结算。',
  abilities: [],
}
