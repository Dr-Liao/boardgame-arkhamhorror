// 06257 · 《无归之地》地点「食尸鬼平原」（Plain of the Ghouls · 中心 · 帷幕 4 · 线索 1/人 · 胜利 1）。
// 卡面：Veiled.
//   [[Gug]] enemies cannot enter the Plain of the Ghouls. If a [[Gug]] enemy would spawn at the
//   Plain of the Ghouls, spawn it at the City of Gugs instead.
// 背面故事 06257b「诡异食尸鬼」：调查员合计至少 3/人 线索时可共同花费 3/人 线索并推进当前幕；
//   不足时翻回（可再次翻面）。
//
// 掩藏翻面由共享层处理；Gug 限制由 behavior.spawnLocation / enemyMoved 读本条目的 flags 执行；
// 故事效果由 behavior.storyResolve 按 flags.storyRule 分派。

export default {
  code: '06257',
  scope: 'location',
  implemented: true,
  flags: {
    veiled: true,
    shuffleBack: false, // en rules / Haskell 均无「翻面后洗回」规则（见 worker 报告）
    flipStory: '06257b',
    gugCannotEnter: true,
    gugSpawnRedirectTo: 'cityOfGugs',
  },
}
