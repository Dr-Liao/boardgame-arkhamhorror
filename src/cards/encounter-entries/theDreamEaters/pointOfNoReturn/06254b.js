// 06254b · 《无归之地》背面故事「阴森隧道」（Ghastly Tunnels）。
// 卡面：Search the encounter deck and discard pile for a [[Ghast]] enemy and spawn it here exhausted
//   and with 1 clue on it. Shuffle the encounter deck.
//   Flip this card back over.
//
// 翻面故事（辛之墓穴 06254 的背面）：规则由章节目录 behavior.js 的 storyResolve 按 flags.storyRule
// 分派执行；本条目声明身份、implemented 读点与规则键。

export default {
  code: '06254b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'ghastlyTunnels',
    storyOf: '06254',
  },
  note: '线索放到敌人身上走 api.addCluesToEnemy（P8 已交付）。',
}
