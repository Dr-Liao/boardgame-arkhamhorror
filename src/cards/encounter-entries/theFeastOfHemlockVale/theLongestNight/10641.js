// 10641 病俘
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：敌军阶段各重整未交战敌人攻击病俘（恐惧改为伤害）。强制 - 病俘被击败时：进入结局 3。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10641',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    captives: true,
    health: 10,
    guardsFarmhouse: true,
    horrorAsDamage: true,
    defeatToResolution3: true,
    location: 'theFarmhouse'
  },
  note: '病俘伤害记在剧本标记 theLongestNightCaptivesDamage（引擎没有剧情资产生命/伤害读点）；围攻伤害由 behavior.enemyPhaseEnd 结算。'
}
