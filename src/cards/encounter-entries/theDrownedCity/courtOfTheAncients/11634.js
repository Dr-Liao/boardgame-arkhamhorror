// 11634 破损星盘仪[tdc_rune_h] · 诡计（同上；[action] 智识(3) 翻译 rune_h「伊克雷希特」）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：同 11632。
export default {
  code: '11634',
  scope: 'treachery',
  implemented: true,
  flags: {"glyphTreachery":"rune_h","test":{"skill":"intellect","difficulty":3}},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('courtGlyphTreachery', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "approximation：同 11632。",
  abilities: [],
}
