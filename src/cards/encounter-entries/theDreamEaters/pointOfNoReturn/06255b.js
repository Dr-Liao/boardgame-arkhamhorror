// 06255b · 《无归之地》背面故事「岗哨」（The Sentry）。
// 卡面：Spawn the set-aside Gug Sentinel enemy at this location, with 1 [per_investigator] clues on it.
//   Test [agility] (3). If you succeed, Gug Sentinel enters play exhausted and unengaged.
//   Otherwise, it enters play engaged with you. Flip this card back over.
//
// 翻面故事（古革巨人之城 06255 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06255b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'theSentry',
    storyOf: '06255',
  },
  note: '生成放一边的古革哨兵（横置/交战由敏捷(3)检定决定）；敌人线索走 api.addCluesToEnemy（P8 已交付）。',
}
