// 10593b 开阔水域 · 地点（[[沉没]]面，theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[沉没]]。帷幕 5、线索 0、胜利 1。强制 - 你移动进入本地点后：抽取遭遇牌库顶的卡牌。
//
// 翻面由 behavior.sinkLocation 调用 engine/location-face.js 完成（保留 id/线索/遭遇附属）。
// 进入抽牌由 behavior.locationEntered 读 traits 的 [[沉没]] 结算。
export default {
  code: '10593b',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroud: 5, printedClues: 0, printedVictory: 1,
    traits: ['Sunken'], side: 'sunken', moveInDrawEncounter: true, bogFaceCode: '10593a',
  },
  note: '数据型地点条目：沉没面印刷数值；「移动进入后抽遭遇牌」由 behavior.locationEntered 按 [[沉没]] 特性统一结算。',
  abilities: [],
}
