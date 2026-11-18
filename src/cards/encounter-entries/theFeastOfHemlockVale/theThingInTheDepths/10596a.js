// 10596a 泛滥道路 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 1、线索 0。
// [fast] 在你的回合期间，在本地点上放置 1 个伤害标记，作为渗坑：移动（至一个连接地点）。
//
// 快速能力由 behavior.actions 产出（rule 'depthsFloodedPathMove'，0 行动），
// behavior.performAction 放置渗坑并移动。
export default {
  code: '10596a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 1, printedClues: 0,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10596b',
    fastAction: { action: 'depthsFloodedPathMove', sinkholeCost: 1 },
  },
  note: '数据型地点条目；快速「放渗坑→移动」由 behavior.actions/performAction 结算。',
  abilities: [],
}
