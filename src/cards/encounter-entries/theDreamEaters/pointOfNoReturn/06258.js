// 06258 · 《无归之地》地点「食尸鬼峭壁」（Crag of the Ghouls · 山谷 · 帷幕 3 · 线索 2/人 · 胜利 1）。
// 卡面：Veiled.
//   The first treachery drawn during the mythos phase by an investigator at this location gains surge.
// 背面故事 06258b「探查山谷」：Look at the top 2 [per_investigator] cards of the encounter deck.
//   You may discard up to half of those cards. Return the rest to the top of the encounter deck, in any
//   order. For the remainder of the game, ignore the text on Crag of the Ghouls. Flip this card back over.
//
// 掩藏翻面由共享层处理；「神话阶段本地点调查员抽到的第一张诡计获得涌动」由
// behavior.encounterGainsSurge 读本条目的 flags 执行；故事效果由 behavior.storyResolve 分派。

export default {
  code: '06258',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06258b',
    firstMythosTreacherySurge: true,
  },
}
