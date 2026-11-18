// 10649 无尽夜晚
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：险境。显现 - 你必须决定：移除密谋上 1 个毁灭 / 对病俘造成 2 点伤害 / 受到 3 点直接伤害和 3 点直接恐惧。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10649',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    peril: true
  },
  flags: {
    peril: true,
    revelation: 'chooseOne'
  },
  note: '显现走 behavior.events.theLongestNightEndlessNight（条目 encounterResolve → api.resolveScenarioEvent，与引擎同一座桥）。',
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('theLongestNightEndlessNight', { seat: inv.seat }) === true
  }
}
