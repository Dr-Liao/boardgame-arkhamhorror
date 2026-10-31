// 06254 · 《无归之地》地点「辛之墓穴」（Vaults of Zin · 帷幕 3 · 线索 1/人 · 胜利 1）。
// 卡面：Veiled.
// 背面故事 06254b「阴森隧道」：Search the encounter deck and discard pile for a [[Ghast]] enemy and
//   spawn it here exhausted and with 1 clue on it. Shuffle the encounter deck. Flip this card back over.
//
// 掩藏的 [fast] 翻面行动由战役共享层（encounter-rules.veiledFastActions / performVeiledFlip）提供；
// 背面故事效果由 behavior.js 的 storyResolve 按 flags.storyRule 分派。本条目只声明身份与数据键。

export default {
  code: '06254',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    flipStory: '06254b',
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
  },
}
