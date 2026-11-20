// 11633 古代秘库[tdc_rune_i] · 诡计（同上；[action] 战斗(3) 翻译 rune_i「克苏鲁」）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：approximation：同 11632。
export default {
  code: '11633',
  scope: 'treachery',
  implemented: true,
  flags: {"glyphTreachery":"rune_i","test":{"skill":"combat","difficulty":3}},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('courtGlyphTreachery', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "approximation：同 11632。",
  abilities: [],
}
