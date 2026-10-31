// 06260b · 《无归之地》背面故事「山谷住民」（Inhabitants of the Vale）。
// 卡面：Search the encounter deck and discard pile for a Hunting Nightgaunt and spawn it at Vale of
//   Pnath, exhausted. Each investigator at Peaks of Thok may draw 2 cards.
//   Choose any enemy in play and place 2 clues on it. Flip this card back over.
//
// 翻面故事（撒克山峰 06260 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06260b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'inhabitantsOfTheVale',
    storyOf: '06260',
    enemy: '01172', // Hunting Nightgaunt（核心包 · 夜魇组）
    spawnLocationId: 'valeOfPnath',
    drawCards: 2,
    enemyClues: 2,
  },
  note: '「在任意敌人上放 2 线索」走 api.addCluesToEnemy（P8 已交付）。',
}
