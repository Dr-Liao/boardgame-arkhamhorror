// 11567 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11567',
  scope: 'location',
  implemented: true,
  flags: { drawFromBeneathLostCampsite: true },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryPlaceLocation', { code: card.code, seat: inv.seat }) === true
  },
  note: '迷失营地从遭遇牌库入场时由章节结算显现。地点已揭示且牌堆非空时，在此可花费一次行动抽取营地下的顶牌，照常结算其遭遇牌效果。',
  abilities: [],
}
