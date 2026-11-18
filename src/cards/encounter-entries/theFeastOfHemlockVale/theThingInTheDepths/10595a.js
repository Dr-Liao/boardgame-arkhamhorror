// 10595a 腐臭池塘 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 2，每名调查员 1 条线索。本地点上每有一个渗坑，得到 +1 帷幕。
//
// 「每渗坑 +1 帷幕」由 behavior.locationShroudModifier 读取 location.damage。
export default {
  code: '10595a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2, printedCluesPerInvestigator: 1,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10595b', shroudPerSinkhole: 1,
  },
  note: '数据型地点条目；+1 帷幕/渗坑由 behavior.locationShroudModifier 按 damage 动态返回。',
  abilities: [],
}
