// 10629 最长一夜
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[fast] 你的回合花费 1 线索：放置 1 个屏障、诱饵或陷阱。[action] 撤退（全员撤退 → 结局 3）。目标：活过今夜（未受指示不推进）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10629',
  scope: 'act',
  implemented: true,
  flags: {
    fastDefenseClueCost: 1,
    resign: true,
    noAutoAdvance: true
  },
  note: '幕面不自动推进：behavior.checkObjectives 返回 false（引擎读点）；快速工事与撤退由 behavior.actions/performAction 与幕面文本提供。'
}
