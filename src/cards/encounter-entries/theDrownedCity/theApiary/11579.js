// 11579 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11579',
  scope: 'location',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryPlaceLocation', { code: card.code, seat: inv.seat }) === true
  },
  note: "data-type：隐藏秘库[tdc_rune_u]（victory 1）。显现：放入场地 + behavior.applyRevelation（进场后从遭遇牌库与弃牌堆找一名敌人生成在此）；[reaction] 成功躲避且超出难度 2 点 → 翻面结算 11579b（events.apiaryFlipHiddenVault）。",
  abilities: [],
}
