// 06257b · 《无归之地》背面故事「诡异食尸鬼」（A Strange Ghoul）。
// 卡面：If the investigators possess fewer than 3 [per_investigator] clues: Try as you might, you
//   cannot make any headway... Flip this card back over. This card may be flipped over again when you
//   are ready.
//   If the investigators possess at least 3 [per_investigator] clues: ... The investigators must spend
//   3 [per_investigator] clues, as a group. Advance the current act. Flip this card back over.
//
// 翻面故事（食尸鬼平原 06257 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06257b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'aStrangeGhoul',
    storyOf: '06257',
    // 团队线索门槛：3 × 人数；达成后共同花费并推进当前幕。
    clueThresholdPerInvestigator: 3,
    spendClues: true,
    advanceAct: true,
  },
  note: '线索不足时翻回并可再次翻面（共享层翻面动作之外的重置由 behavior 处理）。',
}
