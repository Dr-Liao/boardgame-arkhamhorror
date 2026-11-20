// 11608 古代秘库[tdc_rune_o] · 诡计（显现：附属到所在地点；[action] 翻译 → 翻面 11608b 并加入胜利区）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 近似：翻译行动在 behavior.actions 的「翻译符文」里结算；「弃掉印刷资源费用合计 ≥ 隐藏值」的支援费用未接线（近似）。
export default {
  code: '11608',
  scope: 'treachery',
  implemented: true,
  flags: {"glyph":true,"ancientVault":true,"attachToLocation":true},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('grandVaultAncientVault', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "翻译行动在 behavior.actions 的「翻译符文」里结算；「弃掉印刷资源费用合计 ≥ 隐藏值」的支援费用未接线（近似）。",
  abilities: [],
}
