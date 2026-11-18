// 10688 围坐桌边 · 议程（印刷同时充当幕：STAGE_CARD_CODE）· 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10688）：毁灭阈值 6。
//   目标 - 直面蕾切尔嬷嬷！如果蕾切尔嬷嬷被击败：（→ 结局 1）。
//   背面「The Sleep（沉睡）」：每位调查员被击败并承受 1 点精神创伤或 1 点肉体创伤。
//
// 读点（数据型条目，规则在章节层）：preludeTheFinalEvening 把本卡同时实例成幕与议程
//   （同卡号、同正文，各一条身份记录）；「蕾切尔嬷嬷被击败 → 结局 1」在 behavior.checkObjectives /
//   enemyDefeated（读 10693b 的击败状态），背面「每人被击败 + 1 创伤」在 behavior.agendaReveal。
export default {
  code: '10688',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 6,
    stage: 1,
    alsoActsAsAct: true,
    singleStageCard: true,
    objective: { type: 'defeatMotherRachel', resolution: 'resolution1' },
    back: {
      name: 'The Sleep',
      defeatEachInvestigator: true,
      traumaChoice: ['mental', 'physical'],
    },
  },
  note: '数据型议程条目：目标与背面在 preludeTheFinalEvening 的 behavior（checkObjectives / enemyDefeated / agendaReveal）。',
  abilities: [],
}
