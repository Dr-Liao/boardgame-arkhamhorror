// 09542 饥荒
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：显现 - 将饥荒放入场上，放在议程牌库旁。你打出的每张牌费用 +1。
// 强制 - 轮末：从场上弃掉饥荒。
//
// 一张卡一个文件：轮末弃置由引擎读 `treacheryRule.discardAtRoundEnd`（phases.js）；
// 显现经章节事件把饥荒放在密谋旁，保留抽牌调查员的座位供费用读取。
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
}
