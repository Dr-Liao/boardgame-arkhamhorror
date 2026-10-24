// 05105 苦痛之地
// 归属：战役共用 · theCircleUndone；遭遇组：realm_of_death
// 卡面：显现 - 将苦痛之地放置入场，放到你的威胁区域。
// 卡面：强制 - 在你的回合开始时：结算你所在地点的每个闹鬼能力。
// 卡面：强制 - 在你的回合结束时：检定[willpower](3)。如果你检定成功，弃掉苦痛之地。
//
// 回合开始/结束的强制由 encounter-rules.js 的 turnBegins / turnEnded 共享钩子按
// treacheryRule 的纯数据字段执行（函数不能放进 treacheryRule：它会并进场景定义）。

export default {
  code: '05105',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    threatArea: true,
    turnBeginsHaunted: true,
    turnEndTest: { skill: 'willpower', difficulty: 3 },
  },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '05105')
    api.info?.('「苦痛之地」进入你的威胁区域。')
    return true
  },
}
