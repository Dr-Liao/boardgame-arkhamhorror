// 09542 饥荒
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：显现 - 将饥荒放入场上，放在议程牌库旁。你打出的每张牌费用 +1。
// 强制 - 轮末：从场上弃掉饥荒。
//
// 一张卡一个文件：轮末弃置由引擎读 `treacheryRule.discardAtRoundEnd`（phases.js）；
// 显现（放在议程旁 + 费用 +1）由 encounterResolve 经 api.resolveScenarioEvent 交给章节
// behavior.events.deadHeatFamine（费用读点是引擎既有的 location.playCostIncrease）。
export default {
  code: '09542',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { discardAtRoundEnd: true },
  flags: {
    famine: true,
    besideAgenda: true,
    playCostIncrease: 1,
  },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('deadHeatFamine', { seat: inv.seat }) === true
  },
  note: '近似：费用 +1 写在所有在场地点的 playCostIncrease（引擎的唯一读点）；因此对全桌生效，而不是只对「你」生效。',
}
