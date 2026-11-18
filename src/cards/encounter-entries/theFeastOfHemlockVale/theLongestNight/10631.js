// 10631 牛奶房
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[reaction] 你要在牛奶房放诱饵/陷阱时：改放相邻地点。[action] 抽 1 张放在一边的 Fire!；把另 1 张洗入遭遇牌库（每轮一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10631',
  scope: 'location',
  implemented: true,
  flags: {
    milkhouse: true,
    redirectDefenseToAdjacent: true,
    fireActionPerRound: true,
    fireActionLimit: 'round'
  },
  note: '「改放相邻地点」由 behavior.placeDefense 结算（引擎的 placeLocationDefense 不做重定向）。'
}
