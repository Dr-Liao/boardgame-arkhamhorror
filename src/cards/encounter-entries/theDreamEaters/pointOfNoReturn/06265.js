// 06265 · 《无归之地》地点「漆黑之海」（Sea of Pitch · 深海 · 帷幕 X · 线索 1/人）。
// 卡面：Veiled.
//   X is the number of damage tokens on the scenario reference card.
// 背面故事 06265b「大海中央」：调查员合计至少 3/人 线索时可共同花费 3/人 线索，
//   翻面并推进当前幕；不足时翻回（可再次翻面）。
//
// 掩藏翻面由共享层处理；帷幕 X 由 behavior.locationShroudModifier 读 flags 求值；
// 故事效果由 behavior.storyResolve 分派。

export default {
  code: '06265',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06265b',
    shroudEqualsReferenceDamage: true,
  },
}
