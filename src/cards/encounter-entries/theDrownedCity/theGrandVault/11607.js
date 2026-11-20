// 11607 致命机械 · 诡计 ×3（意志(3)；失败后：使最近已激活[[秘库]]失活 / 抽放在一边的秘库随从 / 移动到相邻地点）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：行为在 behavior.events.grandVaultDeadlyMechanisms；
//       「失败改选两项」印刷英文为 "choose two instead if it is act 2"（中文卡表误译为「场景2」）：
//       按当前幕判定（GV 只有 2 幕；第二幕 = ACT2_CODE）。
export default {
  code: '11607',
  scope: 'treachery',
  implemented: true,
  flags: {"test":{"skill":"willpower","difficulty":3}},
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('grandVaultDeadlyMechanisms', { seat: inv.seat, code: card?.originalCode || card?.code }) === true
  },
  note: "检定与三项选择在 behavior.events.grandVaultDeadlyMechanisms；失败改选两项按「当前为第二幕」判定（英文卡面 act 2）。",
  abilities: [],
}
