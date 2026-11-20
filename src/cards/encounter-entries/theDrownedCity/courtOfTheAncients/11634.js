// 11634 破损星盘仪[tdc_rune_h] · 诡计（显现：从弃牌堆抽取时附属到所在地点，否则弃掉并获得涌动；
//        [action] 智识(3) 翻译 rune_h「伊克雷希特」）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点同 11632：encounterResolve 第 5 参 encounteredFrom → behavior.events.courtGlyphTreachery。
export default {
  code: '11634',
  scope: 'treachery',
  implemented: true,
  flags: {"glyphTreachery":"rune_h","test":{"skill":"intellect","difficulty":3}},
  encounterResolve(state, inv, card, api, context = {}) {
    return api.resolveScenarioEvent('courtGlyphTreachery', {
      seat: inv.seat,
      code: card?.originalCode || card?.code,
      from: context.encounteredFrom ?? 'deck',
      locationId: context.location?.id ?? inv.location,
    })
  },
  note: "数据型条目：抽牌来源分支在 behavior.events.courtGlyphTreachery（弃牌堆→附属；否则弃掉+涌动）；翻译检定做成地点行动。",
  abilities: [],
}
