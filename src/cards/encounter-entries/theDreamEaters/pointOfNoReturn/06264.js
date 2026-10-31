// 06264 · 《无归之地》地点「漆黑之海」（Sea of Pitch · 深海 · 帷幕 X · 线索 1/人）。
// 卡面：Veiled.
//   X is the number of damage tokens on the scenario reference card.
// 背面故事 06264b「起伏的漩涡」：Set all of the clues from each Sea of Pitch aside.
//   Discard all other tokens and attachments from each Sea of Pitch.
//   Flip this card back over and shuffle the positions of each copy of Sea of Pitch so you do not know
//   which is which (investigators and enemies remain at their current position).
//   Distribute the previously set-aside clues among each copy of Sea of Pitch, as evenly as possible.
//   Each Sea of Pitch may be flipped over again using their veiled keyword.
//
// 掩藏翻面由共享层处理；帷幕 X 由 behavior.locationShroudModifier 读 flags 求值；
// 故事效果由 behavior.storyResolve 分派（位置混洗无引擎表达 → 记 simplified）。

export default {
  code: '06264',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06264b',
    shroudEqualsReferenceDamage: true,
  },
}
