// 10639 外围农田（焦灼小丘）
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[reaction] 你发现本地点的最后线索后：在本地点放置 1 个陷阱。[fast] 你的回合：把任意地点的一个陷阱移到另一个地点（每回合一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10639',
  scope: 'location',
  implemented: true,
  flags: {
    outerField: true,
    direction: 'south',
    trapOnLastClue: true,
    moveTrapPerTurn: true
  },
  note: '最后线索反应由 behavior.cluesRemoved；移动陷阱由 behavior.actions 的快速行动。'
}
