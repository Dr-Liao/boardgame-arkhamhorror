// 06262b · 《无归之地》背面故事「蛛群之海」（Spider-Infested Waters）。
// 卡面：Shuffle the encounter discard pile into the encounter deck and discard cards from the top until
//   a [[Spider]] enemy is discarded. Spawn that enemy here with 1 [per_investigator] clues on it
//   (if it is swarming, place those clues on the host enemy). Flip this card back over.
//
// 翻面故事（漆黑之海 06262 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06262b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'spiderInfestedWaters',
    storyOf: '06262',
    enemyCluesPerInvestigator: 1,
  },
  note: '线索放到敌人/蜂拥头领上走 api.addCluesToEnemy（P8 已交付）。',
}
