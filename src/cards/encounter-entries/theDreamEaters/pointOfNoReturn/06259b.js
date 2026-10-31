// 06259b · 《无归之地》背面故事「下方之物」（Something Below）。
// 卡面：If there is no Dhole Tunnel at this location, search the encounter deck and discard pile for a
//   Dhole Tunnel and attach it to this location, if able. Shuffle the encounter deck.
//   If Slithering Dhole is in play, move it to this location and add 2 clues to it. Otherwise, search
//   the encounter deck, discard pile, and victory display for Slithering Dhole, and spawn it at this
//   location, exhausted and with 2 clues on it. Flip this card back over.
//
// 翻面故事（骸骨之海 06259 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06259b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'somethingBelow',
    storyOf: '06259',
    attachTreachery: '06272', // Dhole Tunnel
    enemy: '06271', // Slithering Dhole
    enemyClues: 2,
  },
  note: '胜利区取回走 api.takeFromVictory、敌人线索走 api.addCluesToEnemy（P8 均已交付，见 behavior.storyResolve）。',
}
