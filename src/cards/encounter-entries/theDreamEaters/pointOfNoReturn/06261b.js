// 06261b · 《无归之地》背面故事「逃生之路」（The Way Out）。
// 卡面：If the investigators possess fewer than 3 [per_investigator] clues: ... Flip this card back over.
//   This card may be flipped over again when you are ready.
//   If the investigators possess at least 3 [per_investigator] clues: ... The investigators must spend
//   3 [per_investigator] clues, as a group. Advance the current act. Flip this card back over.
//
// 翻面故事（潘斯山谷 06261 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06261b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'theWayOut',
    storyOf: '06261',
    clueThresholdPerInvestigator: 3,
    spendClues: true,
    advanceAct: true,
  },
  note: '线索不足时翻回并可再次翻面（由 behavior 重置翻面标记）。',
}
