// 10627 屏障、诱饵和陷阱
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：标记效果：资源强制（关键词移动时移除 1 个屏障并取消移动）／恐惧强制（进入诱饵地点：移除诱饵、1 伤害、解除交战、横置且本轮不能重整）／伤害强制（进入陷阱地点：移除陷阱、2 伤害）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10627',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    tokenReference: true,
    barriersDecoysTraps: true,
    global: true
  },
  note: '工事参考卡：屏障/诱饵/陷阱的强制结算由引擎 location-defenses.js 读取 scenario.mechanics.defenses 结算，本条目只声明参考卡身份与置位入口。'
}
