// 10689 待宰羔羊 · 特别议程（放一边，阶段 3）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10689，stage 3，毁灭阈值 5）：
//   你不能触发[codex]抄本条目。
//   [reaction] 你成功躲避[[居民]]敌人且超过难度至少 2 点后：将其加入胜利区。
//   目标 - 如果有 1[per_investigator]+1 张[[居民]]卡牌在胜利区，（→ 结局 3）。
//   背面「Back in the Fold（回到归宿）」：所有调查员撤退。
//
// 读点（数据型条目，规则在章节层）：preludeTheFinalEvening 的 behavior 已实现三句：
//   · 法典封锁 —— behavior.codexAvailable 在 currentAgendaCode === '10689' 时返回 false；
//   · 躲避后进胜利区 —— behavior.afterTest（successBy ≥ 2 且目标的敌人面属[[居民]]）；
//   · 目标 —— behavior.checkObjectives 按 residentVictoryTarget = 1 + 1/人 结算（→ 结局 3）；
//   背面「所有调查员撤退」在 behavior.agendaReveal。条目只声明数值与身份。
export default {
  code: '10689',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 5,
    stage: 3,
    specialAgenda: true,
    blocksCodexEntries: true,
    reactionAfterEvadeResidentBy: { margin: 2, destination: 'victoryDisplay' },
    objective: { type: 'residentVictory', base: 1, perInvestigator: 1, resolution: 'resolution3' },
    back: { name: 'Back in the Fold', allResign: true },
  },
  note: '数据型议程条目：法典封锁/躲避进胜利区/目标/背面四处读点都在 preludeTheFinalEvening 的 behavior。',
  abilities: [],
}
