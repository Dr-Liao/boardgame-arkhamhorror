// 06252 · 《无归之地》幕 2a「深入」（The Descent）。
// 卡面：Forced - After an enemy with 1 or more clues on it is defeated: Take control of each of those clues.
//   Objective - Find the way to the Sea of Pitch. (You will be instructed when to advance.)
// 卡面（背面 / 推进）：Put each set-aside [[Depths]] location into play.
//   Shuffle the set-aside Descent into the Pitch and Agents of Atlach-Nacha encounter sets into the
//   encounter deck, along with the discard pile.
//
// 规则唯一实现在 behavior.js（actReveal / actLeftPlay / enemyDefeated 按 advanceRule 分派）。

export default {
  code: '06252',
  scope: 'act',
  implemented: true,
  flags: {
    advanceRule: 'theDescent',
    takeCluesOnEnemyDefeat: true,
    placeSetAsideLocations: { trait: 'Depths' },
    shuffleIntoDeckGroups: ['descentIntoThePitch', 'agentsOfAtlachNacha'],
    shuffleDiscardIntoDeck: true,
  },
}
