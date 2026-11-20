// 11665 · treachery · obsidianCanyons
//
// 圣艾尔摩之火（×2）。显现：附属到最近一处未附属本卡的地点；轮末本地点每位调查员受 1 伤害，附属移到相邻地点（尽可能有调查员）。encounterResolve → behavior.events.obsidianStElmosFire；轮末在 behavior.roundEnded → stElmosRoundEnd。
// 读点：encounterResolve → api.resolveScenarioEvent('obsidianStElmosFire') → behavior.events.obsidianStElmosFire。
export default {
  code: '11665',
  scope: 'treachery',
  implemented: true,
  flags: { attachToNearestLocation: true, roundEndDamage: 1 },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('obsidianStElmosFire', { seat: inv.seat }) === true
  },
  note: "圣艾尔摩之火（×2）。显现：附属到最近一处未附属本卡的地点；轮末本地点每位调查员受 1 伤害，附属移到相邻地点（尽可能有调查员）。encounterResolve → behavior.events.obsidianStElmosFire；轮末在 behavior.roundEnded → stElmosRoundEnd。",
}
