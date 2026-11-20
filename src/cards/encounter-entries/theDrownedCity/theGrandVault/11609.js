// 11609 古代秘库[tdc_rune_n] · 诡计（显现：附属到所在地点；[action] 受到合计 X 伤害/恐惧 → 翻面）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：behavior.actions 提供「翻译已附属的古代秘库」行动；费用 = 受到合计 X（= 附属地点隐藏值）
//       点伤害和/或恐惧，由 behavior 的翻译行动逐点选择并真实现（伤害/恐惧分别走引擎结算）。
export default {
  code: '11609',
  scope: 'treachery',
  implemented: true,
  flags: {"glyph":true,"ancientVault":true,"attachToLocation":true},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('grandVaultAncientVault', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "附属于地点在 behavior.events.grandVaultAncientVault；[action] 翻译行动与「合计 X 伤害/恐惧」的费用在 behavior.actions/performAction 实现。",
  abilities: [],
}
