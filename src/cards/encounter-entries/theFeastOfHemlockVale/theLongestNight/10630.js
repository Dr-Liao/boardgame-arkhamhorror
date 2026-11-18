// 10630 农庄
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：农庄不能有玩家卡牌附属、陷阱、诱饵。[fast] 花费 1[per_investigator] 资源：移动到连接地点。[action] 获得 1 个线索（团队每轮一次）。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10630',
  scope: 'location',
  implemented: true,
  flags: {
    farmhouse: true,
    cannotHavePlayerAttachments: true,
    cannotHaveDecoys: true,
    cannotHaveTraps: true,
    fastMoveCostPerInvestigator: 1,
    clueActionGroupLimit: 'round'
  },
  note: '农庄的 noLocationDefenses 写在 definition 的地点对象上（引擎 location-defenses.js 的真实读点）；快速移动与获得线索在 behavior.actions/performAction。'
}
