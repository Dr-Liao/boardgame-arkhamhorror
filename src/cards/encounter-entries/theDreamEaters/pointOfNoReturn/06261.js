// 06261 · 《无归之地》地点「潘斯山谷」（Vale of Pnath · 山谷 · 帷幕 4 · 线索 1/人 · 胜利 1）。
// 卡面：Veiled.
//   While there are clues remaining on Vale of Pnath, investigators at Vale of Pnath cannot play cards
//   or commit cards to skill tests.
// 背面故事 06261b「逃生之路」：调查员合计至少 3/人 线索时可共同花费 3/人 线索并推进当前幕；
//   不足时翻回（可再次翻面）。
//
// 掩藏翻面由共享层处理；「仍有线索时不能打出/投入卡牌」由 behavior.canPlayCard/canCommitCard
// 读本条目 flags 执行；故事效果由 behavior.storyResolve 分派。

export default {
  code: '06261',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06261b',
    blocksPlayAndCommitWhileClues: true,
  },
}
