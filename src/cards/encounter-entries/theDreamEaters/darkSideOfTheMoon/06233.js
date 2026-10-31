// 06233 弱点「卡达斯」（False Awakening · [[诅咒]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// 每场游戏开始时，将卡达斯放在密谋牌库旁边，并在其上放置 1 个毁灭标记。
// [action]：检定任意技能（2）。本次检定难度 +1[per_investigator]。如果你检定成功，将卡达斯从游戏中移除。
// 任意调查员均可以触发本能力。
//
// 依据 Haskell Treachery/Cards/.../FalseAwakening.hs（开局在密谋牌库旁（Investigator/Scenario Runner 硬编码）、
// chooseOneM 任意技能 beginSkillTest Fixed (2 + perPlayer 1)、成功 removeFromGame）：
//   · 开局摆放 → flags.startsNextToAgendaDeck（本章 behavior.preScenarioSetup 读本数据放进 scenarioFlags.agendaAside）；
//   · 任意调查员可发动的行动 → treacheryRule.agendaAsideAction 数据，behavior.actions/performAction 统一提供；
//     成功后从 agendaAside 移除并进 removedFromGame（章节内容层写，条目只声明数据）。
export default {
  code: '06233',
  scope: 'treachery',
  implemented: true,
  flags: {
    startsNextToAgendaDeck: true,
    doomOnStart: 1,
    weakness: true,
  },
  treacheryRule: {
    agendaAsideAction: {
      rule: 'tshFalseAwakening',
      label: '[action]：检定任意技能（2+1[per_investigator]），成功将卡达斯从游戏中移除',
      baseDifficulty: 2,
      perInvestigatorBonus: 1,
      anySkill: true,
      anyInvestigator: true,
    },
  },
  note: '「在密谋牌库旁」用 scenarioFlags.agendaAside 纯数据表达（无 TDE agendaAside 共享区）；其上 1 个毁灭标记是摆放标记，不计入密谋阈值（与参考实现一致）。',
}
