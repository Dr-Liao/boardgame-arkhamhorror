// 10640 外围农田（腐败作物）
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[reaction] 你发现本地点的最后线索后：在本地点放置 1 个诱饵。[fast] 你的回合：把任意地点的一个诱饵移到另一个地点（每回合一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10640',
  scope: 'location',
  implemented: true,
  flags: {
    outerField: true,
    decoyOnLastClue: true,
    moveDecoyPerTurn: true,
    removedAtSetup: true
  },
  note: '印刷在布置时随机移除此卡：本实现固定移除它（见 behavior.approximations 第 1 条），因此它的能力只在改回在场时可用。'
}
