// 06265b · 《无归之地》背面故事「大海中央」（Center of the Sea）。
// 卡面：If the investigators possess fewer than 3 [per_investigator] clues: ... Flip this card back over.
//   This card may be flipped over again when you are ready.
//   If the investigators possess at least 3 [per_investigator] clues: ... The investigators must spend
//   3 [per_investigator] clues, as a group. Flip this card back over and advance the current act.
//
// 翻面故事（漆黑之海 06265 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06265b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'centerOfTheSea',
    storyOf: '06265',
    clueThresholdPerInvestigator: 3,
    spendClues: true,
    advanceAct: true,
  },
  note: '线索不足时翻回并可再次翻面（由 behavior 重置翻面标记）。',
}
