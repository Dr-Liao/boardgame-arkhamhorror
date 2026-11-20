// 11632 古代秘库[tdc_rune_g] · 诡计（显现：从弃牌堆抽取时附属到所在地点，否则弃掉并获得涌动；
//        [action] 意志(3) 翻译 rune_g「生命」）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：encounterResolve 第 5 参 encounteredFrom（'deck'|'discard'|'search'）→
//       behavior.events.courtGlyphTreachery：弃牌堆来源 → 附属到地点（返回 { placed: true } 抑制弃牌）；
//       其余来源 → 弃掉本卡并获得涌动（额外抽 1 张遭遇牌）。
//       翻译检定在 behavior.actions 的 courtTranslateGlyph 地点行动。
export default {
  code: '11632',
  scope: 'treachery',
  implemented: true,
  flags: {"glyphTreachery":"rune_g","test":{"skill":"willpower","difficulty":3}},
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
