// 06264b · 《无归之地》背面故事「起伏的漩涡」（Rolling Pits）。
// 卡面：Set all of the clues from each Sea of Pitch aside.
//   Discard all other tokens and attachments from each Sea of Pitch.
//   Flip this card back over and shuffle the positions of each copy of Sea of Pitch so you do not know
//   which is which (investigators and enemies remain at their current position).
//   Distribute the previously set-aside clues among each copy of Sea of Pitch, as evenly as possible.
//   Each Sea of Pitch may be flipped over again using their veiled keyword.
//
// 翻面故事（漆黑之海 06264 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06264b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'rollingPits',
    storyOf: '06264',
    // 位置混洗：引擎没有「地点位置/标签」概念，按「线索平均分配 + 重置可翻面」近似。
    redistributeCluesEvenly: true,
    resetVeiledFlippable: true,
  },
  note: '「打乱各张漆黑之海的位置」无引擎表达（simplified）；线索平均分配与重置翻面标记由 behavior 处理。',
}
