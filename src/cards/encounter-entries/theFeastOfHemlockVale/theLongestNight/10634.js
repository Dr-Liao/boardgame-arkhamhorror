// 10634 谷仓
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：谷仓的敌人 +1 伤害值。强制 - 谷仓揭示时：把放在一边的埃阿斯放到本地点（[codex] Ω）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10634',
  scope: 'location',
  implemented: true,
  flags: {
    barn: true,
    enemyDamageModifier: 1,
    codexOnReveal: 'omega',
    setAsideAsset: '10642'
  },
  note: '揭示时入场由 behavior.locationPlaced → enterAjax（本关地点开场即揭示，因此入场即触发）；+1 伤害由 behavior.enemyAttackModifier。'
}
