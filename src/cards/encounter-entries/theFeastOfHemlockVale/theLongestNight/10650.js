// 10650 入侵
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：显现 - 检定[敏捷](X，场上毁灭的一半向上取整)；每失败 1 点，选择一个离农庄最近的不同的[[突变]]敌人，重整并让它移动、交战、攻击，如同敌军阶段。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10650',
  scope: 'treachery',
  implemented: true,
  flags: {
    test: {
      skill: 'agility',
      difficulty: 'halfDoom'
    }
  },
  note: '显现走 behavior.events.theLongestNightIncursion（api.test 检定；失败点数逐个触发最近的[[突变]]敌人）。',
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('theLongestNightIncursion', { seat: inv.seat }) === true
  }
}
