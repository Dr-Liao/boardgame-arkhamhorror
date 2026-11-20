// 11632 古代秘库[tdc_rune_g] · 诡计（显现：从弃牌堆抽取时附属到所在地点，否则弃掉并获得涌动；[action] 意志(3) 翻译 rune_g「生命」）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：没有抽牌来源读点，抽到即附属；翻译检定做成地点行动（行为在 behavior.actions）。
export default {
  code: '11632',
  scope: 'treachery',
  implemented: true,
  flags: {"glyphTreachery":"rune_g","test":{"skill":"willpower","difficulty":3}},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('courtGlyphTreachery', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "approximation：没有抽牌来源读点，抽到即附属；翻译检定做成地点行动（行为在 behavior.actions）。",
  abilities: [],
}
