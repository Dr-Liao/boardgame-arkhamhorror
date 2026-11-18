// 10598a 腐烂码头 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 2，每名调查员 1 条线索。
// 强制 - 你发现腐烂码头的线索后：检定[agility](3)。如果你检定失败，在腐烂码头放置 1 个伤害标记，作为渗坑。
//
// 由 behavior.afterInvestigate 在「发现线索后」检定并放渗坑（引擎 afterInvestigate 读点）。
export default {
  code: '10598a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2, printedCluesPerInvestigator: 1,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10598b',
    afterDiscoverCluesTest: { skill: 'agility', difficulty: 3, failSinkhole: 1 },
  },
  note: '数据型地点条目；发现线索后的敏捷检定与失败放渗坑由 behavior.afterInvestigate 结算。',
  abilities: [],
}
