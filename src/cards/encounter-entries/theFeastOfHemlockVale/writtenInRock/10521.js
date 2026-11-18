// 10521 急速狂飙 · 诡计（writtenInRock）
// 卡面：显现 - 检定敏捷（5）。如果失败，将急速狂飙放入你的威胁区。
// 强制 - 当矿车移动时：要么再移动它 2 次，要么对每位调查员、其控制的每个[[盟友]]支援与
// [[居民]]卡各造成 1 点直接伤害与 1 点直接恐惧。弃掉急速狂飙。
// 一张卡一个文件：显现/入威胁区经 api.resolveScenarioEvent 交给 behavior.events.writtenInRockWildRide；
// 「矿车移动时」的强制在 behavior.moveMineCartOnce → resolveWildRides。
export default {
  code: '10521',
  scope: 'treachery',
  implemented: true,
  flags: {
    wildRide: true,
    revelation: { skill: 'agility', difficulty: 5 },
    threatArea: true,
    cartMoveChoice: true,
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('writtenInRockWildRide', { seat: inv?.seat }) === true
  },
  note: '近似：放入威胁区的是轻量卡对象；强制结算用 behavior 的追加移动/直接伤害分支。',
}
