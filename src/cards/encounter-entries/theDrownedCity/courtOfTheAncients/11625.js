// 11625 环形图书馆（古代档案库）· 地点（弃遭遇牌顶时受到 1 直接恐惧并额外弃 3 张）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：弃遭遇牌库顶窗口 encounterCardsDiscardedFromTop（engine scenario-runtime#discardEncounterTop）。
//   · 触发条件 = 决定座位位于本地点且确实弃了牌；
//   · 「受到 1 点直接恐惧」= 反应费用 cost.horror 1（引擎既有费用入口：触发前支付，附加弃牌前结算）；
//   · 额外弃 3 张走 api.discardEncounterTop(3)。
export default {
  code: '11625',
  scope: 'location',
  implemented: true,
  note: "弃顶反应已接线：encounterCardsDiscardedFromTop → cost.horror 1（触发前支付）+ api.discardEncounterTop(3)。",
  abilities: [{
    kind: 'reaction',
    trigger: 'encounterCardsDiscardedFromTop',
    label: '你从遭遇牌库顶弃掉 1 张或更多卡牌时，受到 1 点直接恐惧：从遭遇牌库顶额外弃掉 3 张卡牌',
    cost: { horror: 1 },
    criteria: ({ inv, source, context }) => Boolean(inv) && Number(context?.count) > 0 && source?.id === inv.location,
    resolve: ({ inv, api }) => {
      api.discardEncounterTop(3, { seat: inv.seat })
    },
  }],
}
