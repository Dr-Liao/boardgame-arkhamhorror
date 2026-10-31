// 06263b · 《无归之地》背面故事「平静海面」（Still Surface）。
// 卡面：Look at the other side of another copy of Sea of Pitch. Flip this card back over.
//
// 翻面故事（漆黑之海 06263 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。
// 「查看另一张漆黑之海的另一面」为纯信息效果（把另一张 Sea of Pitch 的背面故事文本放进日志/提示）。

export default {
  code: '06263b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'stillSurface',
    storyOf: '06263',
  },
}
