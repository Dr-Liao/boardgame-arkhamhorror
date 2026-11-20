// 11624 环形图书馆（群星档案库）· 地点（弃遭遇牌顶时可弃 1 手牌额外弃 2 张；[action] 移动到已揭示[[通道]]地点）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：
//   · 弃遭遇牌库顶窗口 encounterCardsDiscardedFromTop（engine scenario-runtime#discardEncounterTop 真弃牌后派发）；
//   · 本条 [reaction] 由地点实例作为来源，criteria 读「弃牌的决定座位位于本地点」；
//   · 费用 = cost.discardHand（弃 1 手牌），结算 = api.discardEncounterTop(2)（再次进入同一窗口）。
//   · [[通道]]移动在 behavior.movePassagewayAction。
export default {
  code: '11624',
  scope: 'location',
  implemented: true,
  flags: {"passageway":true},
  note: "弃顶反应已接线（abilities: encounterCardsDiscardedFromTop，kind reaction，cost.discardHand + api.discardEncounterTop(2)）；[[通道]]移动在 behavior.movePassagewayAction。",
  abilities: [{
    kind: 'reaction',
    trigger: 'encounterCardsDiscardedFromTop',
    label: '你从遭遇牌库顶弃掉 1 张或更多卡牌时，弃掉你手牌中的 1 张卡牌：从遭遇牌库顶额外弃掉 2 张卡牌',
    cost: { discardHand: 1 },
    criteria: ({ inv, source, context }) => Boolean(inv) && Number(context?.count) > 0 && source?.id === inv.location,
    resolve: ({ inv, api }) => {
      api.discardEncounterTop(2, { seat: inv.seat })
    },
  }],
}
