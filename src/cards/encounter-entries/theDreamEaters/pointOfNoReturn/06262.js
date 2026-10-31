// 06262 · 《无归之地》地点「漆黑之海」（Sea of Pitch · 深海 · 帷幕 X · 线索 1/人）。
// 卡面：Veiled.
//   X is the number of damage tokens on the scenario reference card.
// 背面故事 06262b「蛛群之海」：Shuffle the encounter discard pile into the encounter deck and discard
//   cards from the top until a [[Spider]] enemy is discarded. Spawn that enemy here with
//   1 [per_investigator] clues on it (if it is swarming, place those clues on the host enemy).
//   Flip this card back over.
//
// 掩藏翻面由共享层处理；帷幕 X 由 behavior.locationShroudModifier 读 flags 求值
// （X = 剧本参考卡上的伤害数 / Distortion，api.markers）；故事效果由 behavior.storyResolve 分派。

export default {
  code: '06262',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06262b',
    shroudEqualsReferenceDamage: true,
  },
}
