// 06209 议程 III「它们是冲着你来的！」（They Are Upon You!）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。正面只有提示文本；背面「杀戮时刻」（Time to Kill）：
// 每位调查员的警报等级提高 1 级。每位调查员受到等于其警报等级一半（向上取整）的恐惧。
// 将密谋牌库重置到密谋 3a。然后，在该密谋上放置 2 个毁灭标记。
//
// 依据 Haskell Agenda/Cards/.../TheyAreUponYou.hs（raiseAlarmLevel → horror=(alarm+1)/2 → revertAgenda →
// placeDoomOnAgenda 2）：
//   · 「重置密谋牌库到密谋 3a」= 本议程（3a）翻回正面并继续作为当前议程 —— 需要改 agendaIndex 并阻止
//     引擎的默认「推进到下一张议程」；这段顺序流程放在本章 behavior.js 的 `timeToKill` 流程里
//     （章节流程是 behavior 的职责；条目只声明 flow id）。
export default {
  code: '06209',
  scope: 'agenda',
  implemented: true,
  flags: { flow: 'timeToKill' },
  note: '背面「重置到密谋 3a + 放 2 毁灭」由 behavior.agendaReveal 的 timeToKill 流程结算（引擎的边界情况见该流程注释）。',
}
