// 10642 埃阿斯
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：每轮你的第一个行动不触发趁乱攻击。[action] 横置埃阿斯：移动（两次，或到任意[[田野]]地点）。[action] 若埃阿斯在你的地点：控制他。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10642',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    ajax: true,
    noAllySlot: true,
    firstActionNoOpportunity: true,
    moveAbility: true,
    takeControlAction: true
  },
  note: '谷仓揭示时入场（behavior.enterAjax），控制走 behavior.takeControlOfAjax；「不触发趁乱攻击/双倍移动」作为叙事能力保留在 flags（引擎没有对应通用读点）。'
}
