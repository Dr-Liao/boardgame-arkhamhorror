// 10633 鸡笼
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：有诱饵时本地点 -2 帷幕；此处的每个敌人 +1 攻击/+1 躲避。[action] 抽 1 张放在一边的 Fire!；把另 1 张洗入遭遇牌库（每轮一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10633',
  scope: 'location',
  implemented: true,
  flags: {
    coop: true,
    decoyShroudModifier: -2,
    enemyFightModifier: 1,
    enemyEvadeModifier: 1,
    fireActionPerRound: true
  },
  note: '帷幕与敌人修正走 behavior.locationShroudModifier / enemyStatModifier（引擎读点）；Fire! 行动同牛奶房。'
}
