// 10594a 纠葛灌丛 · 地点（Bog 面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沼地]]。帷幕 2，每名调查员 1 条线索。作为移动离开纠葛灌丛的额外费用，你必须花费一个行动。
//
// 额外行动费由 behavior.moveError（合法性/提示）与 behavior.beforeMove（扣 1 行动）读取；
// 效果位移（reason === 'effect'）不加价。
export default {
  code: '10594a',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 2, printedCluesPerInvestigator: 1,
    traits: ['Bog'], side: 'bog', sinkFaceCode: '10594b', leaveExtraActionCost: 1,
  },
  note: '数据型地点条目；离开的额外 1 行动由 behavior.moveError/beforeMove 结算（引擎无地点离开费用原语）。',
  abilities: [],
}
