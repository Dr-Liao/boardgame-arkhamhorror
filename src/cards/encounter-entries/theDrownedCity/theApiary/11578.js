// 11578 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11578',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryDoomNearestEnemy', { seat: inv.seat }) === true
  },
  note: "印刷：涌动；显现 - 在最近的一名其上没有毁灭标记的非[[精英]]敌人上放 1 毁灭。行为在 behavior.events.apiaryDoomNearestEnemy（下方 encounterResolve 调用）。",
  abilities: [],
}
