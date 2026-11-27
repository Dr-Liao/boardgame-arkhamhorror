// 11572 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11572',
  scope: 'location',
  implemented: true,
  flags: { endTurnTest: { skill: 'agility', difficulty: 1 } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryPlaceLocation', { code: card.code, seat: inv.seat }) === true
  },
  note: '中央腔室与其朝向的地点双向相连。调查员在揭示的中央腔室结束回合时检定敏捷(1)，失败时在合法的相连移动与场上主母发起攻击之间选择。',
  abilities: [],
}
