// 06251 · 《无归之地》幕 1a「进入地下世界（版本二）」（Entering the Underworld v. II）。
// 卡面：Forced - After an enemy with 1 or more clues on it is defeated: Take control of each of those clues.
//   Objective - Find Richard Upton Pickman. (You will be instructed when to advance.)
// 卡面（背面 / 推进）：Choose an investigator to take control of the set-aside Richard Upton Pickman
//   story asset. For the remainder of the scenario, if Richard Upton Pickman leaves play, remove him
//   from the game. Put each set-aside [[Vale]] location into play. Find each card from the Striking Fear
//   encounter set (even if they are out of play). Remove them from the game.
//   Shuffle the set-aside Terror of the Vale and Nightgaunts encounter sets into the encounter deck,
//   along with the discard pile.
//
// 规则唯一实现在 behavior.js（actReveal / actLeftPlay / enemyDefeated 按 advanceRule 分派）。

export default {
  code: '06251',
  scope: 'act',
  implemented: true,
  flags: {
    advanceRule: 'enteringTheUnderworldV2',
    takeCluesOnEnemyDefeat: true,
    giveStoryAsset: '06266', // Richard Upton Pickman
    removeStoryAssetOnLeave: '06266',
    placeSetAsideLocations: { trait: 'Vale' },
    removeFromGameGroups: ['strikingFear'],
    shuffleIntoDeckGroups: ['terrorOfTheVale', 'nightgaunts'],
    shuffleDiscardIntoDeck: true,
  },
}
