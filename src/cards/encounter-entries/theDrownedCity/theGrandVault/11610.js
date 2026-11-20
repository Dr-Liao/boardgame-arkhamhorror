// 11610 古代秘库[tdc_rune_p] · 诡计（显现：附属到所在地点；[action] 弃 X 张手牌 → 翻面）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：behavior.actions 提供「翻译已附属的古代秘库」行动；费用 = 选择并弃掉手牌 X 张
//       （X = 附属地点隐藏值），由 behavior 的翻译行动按玩家选择真实现（与 11593 激活费用同一份弃手牌函数）。
export default {
  code: '11610',
  scope: 'treachery',
  implemented: true,
  flags: {"glyph":true,"ancientVault":true,"attachToLocation":true},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('grandVaultAncientVault', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "附属于地点在 behavior.events.grandVaultAncientVault；[action] 翻译行动与「选择弃 X 张手牌」的费用在 behavior.actions/performAction 实现。",
  abilities: [],
}
