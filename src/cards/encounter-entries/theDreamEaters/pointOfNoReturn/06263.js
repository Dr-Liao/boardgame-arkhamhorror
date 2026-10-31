// 06263 · 《无归之地》地点「漆黑之海」（Sea of Pitch · 深海 · 帷幕 X · 线索 1/人）。
// 卡面：Veiled.
//   X is the number of damage tokens on the scenario reference card.
// 背面故事 06263b「平静海面」：Look at the other side of another copy of Sea of Pitch.
//   Flip this card back over.
//
// 掩藏翻面由共享层处理；帷幕 X 由 behavior.locationShroudModifier 读 flags 求值；
// 故事效果由 behavior.storyResolve 分派（「查看另一张漆黑之海的另一面」为纯信息效果）。

export default {
  code: '06263',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06263b',
    shroudEqualsReferenceDamage: true,
  },
}
