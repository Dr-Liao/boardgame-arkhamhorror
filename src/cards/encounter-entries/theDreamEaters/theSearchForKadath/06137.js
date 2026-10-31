// 06137 恩格拉尼克山脉（theSearchForKadath）· 地点（奥瑞巴 / 山脉，掩藏，线索1，帷幕3，胜利1）
// 卡面：掩藏。
// 卡面：强制 - 在你进入恩格拉尼克山脉或发现恩格拉尼克山脉的至少1个线索后，
//       如果调查员还没有「在巴哈那港口获取补给」：检定[combat](3)或[agility](3)。
//       如果你检定失败，失去你所有剩余的行动并立即结束你的回合。
//
// 一卡一文件：规则在这里实现；引擎直接调 locationRule.onEnter.effect，
// 发现线索由章节 behavior.cluesGained 转发到 locationRule.cluesGained。
const SUPPLIES_FLAG = 'obtainedSuppliesFromBaharna'

function forcedTest(state, inv, api) {
  if (api.scenarioFlag?.(SUPPLIES_FLAG) === true) return
  const answer = api.choose?.({
    kind: 'skill', source: '06137', seat: inv.seat,
    prompt: '恩格拉尼克山脉：没有补给，攀爬艰难——选择检定技能。',
    options: [{ id: 'combat', label: '战斗' }, { id: 'agility', label: '敏捷' }],
  }) ?? 'combat'
  const skill = String(answer) === 'agility' ? 'agility' : 'combat'
  api.test?.(inv.seat, skill, 3, result => {
    if (result.success) return
    api.loseActions?.(inv.seat, Math.max(0, Number(inv.actionsLeft) || 0))
    api.endTurn?.(inv.seat)
    api.info?.('🗻 恩格拉尼克山脉：攀爬失败——失去剩余行动并立即结束回合。')
  })
}

export default {
  code: '06137', scope: 'location', implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv || inv.location !== location.id) return
        forcedTest(state, inv, api)
      },
    },
    cluesGained(state, location, inv, amount, api) {
      if (!inv || inv.location !== location.id || !(amount > 0)) return
      forcedTest(state, inv, api)
    },
  },
}
