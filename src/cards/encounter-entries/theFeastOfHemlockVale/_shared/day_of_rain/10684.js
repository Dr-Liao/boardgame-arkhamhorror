// 10684 第二个黎明 · 幕 1 · 共享遭遇组 day_of_rain
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_rain。
// 卡面（cards-data 10684）：
//   调查员不能受到伤害/恐惧，也不能被击败。
//   目标 - 跟当地人聊聊，再多了解一些毒堇岛！
//   背面「A Mistake（错误）」：翻面时读一段正文，然后（[codex] 17）（第 42 页）——即法典 17「The Curse」。
//
// 读点（数据型条目，规则在章节层）：「不能受到伤害/恐惧、不能被击败」= 引擎
//   scenario.mechanics.protectInvestigators（章节 definition 声明）；幕目标不是线索阈值，推进与背面
//   法典 17 的触发在 dawnOfTheSecondDay 的 behavior（actReveal + codex 表）。
export default {
  code: '10684',
  scope: 'act',
  implemented: true,
  flags: {
    stage: 1,
    objective: { type: 'chapterRule', chapterFlow: 'talkToTheLocals', codexThreshold: 3 },
    protectsInvestigators: { damage: true, horror: true, defeat: true },
    back: { name: 'A Mistake', codexNumber: 17, codexId: 'theCurse' },
    preludeOnly: 'dawnOfTheSecondDay',
  },
  note: '数据型幕条目：保护读点 scenario.mechanics.protectInvestigators；背面法典 17 在章节 behavior.actReveal。',
  abilities: [],
}
