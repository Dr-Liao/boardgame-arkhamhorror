// 10638 外围农田（枯萎玉米田）
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[reaction] 你发现本地点的最后线索后：在本地点放置 1 个屏障。[fast] 你的回合：把任意地点的一个屏障移到另一个地点（每回合一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10638',
  scope: 'location',
  implemented: true,
  flags: {
    outerField: true,
    direction: 'north',
    barrierOnLastClue: true,
    moveBarrierPerTurn: true
  },
  note: '最后线索反应由 behavior.cluesRemoved；移动屏障由 behavior.actions 的快速行动（每回合限制）。'
}
