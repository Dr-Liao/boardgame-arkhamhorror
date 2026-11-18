// 10632 葡萄园
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：[fast] 你的回合：与葡萄园的一个敌人交战（每回合一次）。强制 - 敌人进入葡萄园时：治愈其 1 点伤害。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10632',
  scope: 'location',
  implemented: true,
  flags: {
    vineyard: true,
    fastEngagePerTurn: true,
    healEnteringEnemy: 1
  },
  note: '进入治愈由 behavior.enemyMoved；快速交战由 behavior.actions（每回合限制记在剧本标记）。'
}
