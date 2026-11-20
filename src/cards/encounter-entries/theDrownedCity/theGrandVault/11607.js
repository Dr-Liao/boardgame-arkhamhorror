// 11607 致命机械 · 诡计 ×3（意志(3)；失败后：使最近已激活[[秘库]]失活 / 抽放在一边的秘库随从 / 移动到相邻地点）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 近似：当前议程为第二张起（Haskell 的「scenario 2」按第二张议程近似）失败改选两项。
export default {
  code: '11607',
  scope: 'treachery',
  implemented: true,
  flags: {"test":{"skill":"willpower","difficulty":3}},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('grandVaultDeadlyMechanisms', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "当前议程为第二张起（Haskell 的「scenario 2」按第二张议程近似）失败改选两项。",
  abilities: [],
}
