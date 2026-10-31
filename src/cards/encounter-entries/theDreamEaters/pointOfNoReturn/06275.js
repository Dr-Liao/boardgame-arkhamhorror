// 06275 · 《无归之地》弱点诡计「卡达斯」（False Awakening · 诅咒 · 每副牌组限 1 张）。
// 卡面：False Awakening begins each game next to the agenda deck, with 1 doom on it.
//   [action]: Test any skill (2). This test gets +1 [per_investigator] difficulty. If you succeed,
//   remove False Awakening from the game. Any investigator may trigger this ability.
//
// 它不进入威胁区、也不从遭遇牌库抽出：setup 时从牌库/放一边取出放在密谋牌库旁（行为在
// behavior.preScenarioSetup 里读 flags 建立状态），[action] 由 behavior.actions/performAction 分派。
// 数据：任意技能、难度 2 + 1×人数、成功移出游戏。

export default {
  code: '06275',
  scope: 'treachery',
  implemented: true,
  flags: {
    agendaAsideWeakness: true,
    setupDoom: 1,
    anySkillTest: true,
    difficulty: 2,
    difficultyPerInvestigator: 1,
    removeFromGameOnSuccess: true,
    weakness: true,
  },
  note: '「放在密谋牌库旁并有 1  doom」用 scenarioFlags（doom 计入 api.addDoom/removeDoom）近似；离场/推进时的 doom 清理口径记 simplified。',
}
