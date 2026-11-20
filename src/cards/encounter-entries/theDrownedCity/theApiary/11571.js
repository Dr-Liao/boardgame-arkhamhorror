// 11571 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11571',
  scope: 'location',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryPlaceLocation', { code: card.code, seat: inv.seat }) === true
  },
  note: "data-type（地点从遭遇牌库进入）：显现由 behavior.applyRevelation 结算（放入场地 + 该地点显现效果）。酸性体腔（victory 1；从酸性体腔移动到养育场入口的额外费用：受到 1 点伤害）",
  abilities: [],
}
