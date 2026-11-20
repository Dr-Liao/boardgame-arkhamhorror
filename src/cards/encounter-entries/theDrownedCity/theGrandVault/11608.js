// 11608 古代秘库[tdc_rune_o] · 诡计（显现：附属到所在地点；[action] 翻译 → 翻面 11608b 并加入胜利区）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：behavior.actions 提供「翻译已附属的古代秘库」行动；费用 = 选择并弃掉游戏区域中印刷资源
//       费用合计 ≥ 隐藏值（X = 附属地点 shroud）的支援，由 behavior 的翻译行动真实现（含支付校验）。
export default {
  code: '11608',
  scope: 'treachery',
  implemented: true,
  flags: {"glyph":true,"ancientVault":true,"attachToLocation":true},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('grandVaultAncientVault', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "附属于地点在 behavior.events.grandVaultAncientVault；[action] 翻译行动与「弃支援凑齐印刷资源费用 ≥ 隐藏值」的费用在 behavior.actions/performAction 实现。",
  abilities: [],
}
