// 06259 · 《无归之地》地点「骸骨之海」（Sea of Bones · 山谷 · 帷幕 2 · 线索 1/人 · 胜利 1）。
// 卡面：Forced - After you discover 1 or more clues at Sea of Bones: Flip it over.
// 背面故事 06259b「下方之物」：If there is no Dhole Tunnel at this location, search the encounter deck
//   and discard pile for a Dhole Tunnel and attach it to this location, if able. Shuffle the encounter deck.
//   If Slithering Dhole is in play, move it to this location and add 2 clues to it. Otherwise, search the
//   encounter deck, discard pile, and victory display for Slithering Dhole, and spawn it at this location,
//   exhausted and with 2 clues on it. Flip this card back over.
//
// 「发现线索后强制翻面」由 behavior.cluesRemoved 读本条目的 flags 执行（api.clueRemoved 读点同源）；
// 故事效果由 behavior.storyResolve 按 flags.storyRule 分派。

export default {
  code: '06259',
  scope: 'location',
  implemented: true,
  flags: {
    flipStory: '06259b',
    flipOnCluesDiscovered: true,
  },
}
