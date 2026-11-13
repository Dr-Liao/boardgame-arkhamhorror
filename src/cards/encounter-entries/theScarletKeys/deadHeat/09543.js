// 09543 围困！
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：显现 - 检定[战斗](3)。若失败，选择一项：你所在地点 1 名平民被杀害；或承受等于失败点数的伤害。
//
// 一张卡一个文件：encounterResolve 经 api.resolveScenarioEvent 把显现交给章节
// behavior.events.deadHeatCornered 执行检定与二选一；平民走 behavior.slayCivilian（章节唯一写入口），
// 伤害走引擎 api.damage。返回 false 让诡计结算后进入遭遇弃牌堆。
export default {
  code: '09543',
  scope: 'treachery',
  implemented: true,
  flags: {
    cornered: true,
    test: { skill: 'combat', difficulty: 3 },
  },
  encounterResolve(state, inv, card, api) {
    api.resolveScenarioEvent('deadHeatCornered', { seat: inv.seat })
    return false
  },
}
