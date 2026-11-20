// 11562 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11562',
  scope: 'location',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryPlaceLocation', { code: card.code, seat: inv.seat }) === true
  },
  note: "data-type（地点从遭遇牌库进入）：显现由 behavior.applyRevelation 结算（放入场地 + 该地点显现效果）。增生原野（[action] 意志(8) 控制放一边的骇人「面具」；显现时把隐藏秘库一同放置入场）",
  abilities: [],
}
