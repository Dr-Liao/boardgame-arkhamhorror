// 06253 · 《无归之地》幕 3a「无边黑暗」（The Black Expanse）。
// 卡面：Forced - After an enemy with 1 or more clues on it is defeated: Take control of each of those clues.
//   Objective - Find the source of the distortion. (You will be instructed when to advance.)
// 卡面（背面 / 推进）：(→R1)
//
// 规则唯一实现在 behavior.js（actReveal / actLeftPlay / enemyDefeated 按 advanceRule 分派）：
// 推进本幕即结算结局 1（api.finish('resolution1')）。

export default {
  code: '06253',
  scope: 'act',
  implemented: true,
  flags: {
    advanceRule: 'theBlackExpanse',
    takeCluesOnEnemyDefeat: true,
    finishOnAdvance: 'resolution1',
  },
}
