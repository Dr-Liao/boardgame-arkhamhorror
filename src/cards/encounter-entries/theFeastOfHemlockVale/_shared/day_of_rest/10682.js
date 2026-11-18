// 10682 第一日黎明 · 幕 1 · 共享遭遇组 day_of_rest
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_rest。
// 卡面（cards-data 10682）：
//   调查员不能受到伤害/恐惧，也不能被击败。
//   目标 - 和当地人交上朋友，为你的第一次勘察做好准备！（前奏规则见剧本手册第 6 页。）
//   背面「The Brilliance（光辉）」：翻面时读一段正文；你（且只有你）取得 1 点奖励经验值。
//
// 读点（数据型条目，规则在章节层）：
//   · 「不能受到伤害/恐惧、不能被击败」= 引擎 scenario.mechanics.protectInvestigators（enemies.js#applyHarm /
//     harm-threat.js / scenario-runtime 的多处读点）；welcomeToHemlockVale 的 definition 已声明该 mechanics 布尔；
//   · 幕目标不是线索/敌人阈值：definition 用 objective.type = 'chapterRule' + chapterFlow 'befriendTheLocals'，
//     推进由议程背面（10681）与 behavior.agendaReveal 结算；
//   · 背面 The Brilliance 的奖励经验与正文由 behavior.actReveal 读 SCENARIO_TEXT 承接。
export default {
  code: '10682',
  scope: 'act',
  implemented: true,
  flags: {
    stage: 1,
    objective: { type: 'chapterRule', chapterFlow: 'befriendTheLocals' },
    protectsInvestigators: { damage: true, horror: true, defeat: true },
    back: { name: 'The Brilliance', bonusXp: 1, readsStory: true },
    preludeOnly: 'welcomeToHemlockVale',
  },
  note: '数据型幕条目：保护读点是引擎 scenario.mechanics.protectInvestigators（章节 definition 声明），目标与背面在 behavior。',
  abilities: [],
}
