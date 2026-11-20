// 11571 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第二轮「地点移动额外费用」原语：从本地点移动到匹配目的地成功后强制结算伤害
// （读点 src/engine/movement.js#moveAfterCosts；其他出发地不收费）。
export default {
  code: '11571',
  scope: 'location',
  implemented: true,
  locationRule: {
    movementExtraCost: {
      toOriginalCodes: ['11559'],
      cost: { kind: 'damage', amount: 1 },
    },
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('apiaryPlaceLocation', { code: card.code, seat: inv.seat }) === true
  },
  note: "data-type（地点从遭遇牌库进入）：显现由 behavior.applyRevelation 结算（放入场地 + 该地点显现效果）。印刷：victory 1；作为从酸性体腔移动到养育场入口的额外费用，你必须受到 1 点伤害。已接线：locationRule.movementExtraCost（引擎 movement.js#moveAfterCosts 读点；从本地点移动到 11559 成功后受 1 点伤害，从其他地点出发不收费）。全部子句已接线。",
  abilities: [],
}
