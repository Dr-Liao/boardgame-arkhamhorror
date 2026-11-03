// 06275 · 《无归之地》弱点诡计「卡达斯」（False Awakening · 诅咒 · 每副牌组限 1 张）。
// 卡面：False Awakening begins each game next to the agenda deck, with 1 doom on it.
//   [action]: Test any skill (2). This test gets +1 [per_investigator] difficulty. If you succeed,
//   remove False Awakening from the game. Any investigator may trigger this ability.
//
// 开局从持有者牌库取出，作为带 1 毁灭的实体放在密谋牌库旁；任意调查员可发动
// 章节提供的行动，进行难度 2 + 调查员人数的任意技能检定，成功后移出游戏。
// 推进密谋时本卡上的毁灭保留，直到本卡自身离场。

export default {
  code: '06275',
  scope: 'treachery',
  implemented: true,
  doomKeptOnAgendaAdvance: 'self',
  flags: {
    agendaAsideWeakness: true,
    setupDoom: 1,
    anySkillTest: true,
    difficulty: 2,
    difficultyPerInvestigator: 1,
    removeFromGameOnSuccess: true,
    weakness: true,
  },
}
