// 06250 · 《无归之地》幕 1a「进入地下世界（版本一）」（Entering the Underworld v. I）。
// 卡面：Forced - After an enemy with 1 or more clues on it is defeated: Take control of each of those clues.
//   Objective - Explore this region. (You will be instructed when to advance.)
// 卡面（背面 / 推进）：Put each set-aside [[Vale]] location into play.
//   Find each card from the Ghouls encounter set and the Striking Fear encounter set (even if they are
//   out of play). Remove them from the game.
//   Shuffle the set-aside Terror of the Vale and Nightgaunts encounter sets into the encounter deck,
//   along with the discard pile.
//
// 规则唯一实现在 behavior.js（actReveal / actLeftPlay / enemyDefeated 按 advanceRule 分派）；
// 本条目只声明身份、implemented 与数据键。

export default {
  code: '06250',
  scope: 'act',
  implemented: true,
  flags: {
    advanceRule: 'enteringTheUnderworldV1',
    // 站在敌人身上的线索被击败后由击败者接管（全部 act 通用）。
    takeCluesOnEnemyDefeat: true,
    placeSetAsideLocations: { trait: 'Vale' },
    removeFromGameGroups: ['ghouls', 'strikingFear'],
    shuffleIntoDeckGroups: ['terrorOfTheVale', 'nightgaunts'],
    shuffleDiscardIntoDeck: true,
  },
}
