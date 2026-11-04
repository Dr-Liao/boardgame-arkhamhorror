// 07095 印斯茅斯之雾 · 涨潮
//
// 印刷（中文）：
//   显现 - 检定[willpower](3)。如果你检定成功，受到1点恐惧，或将「印斯茅斯之雾」放置入场，
//          放到密谋牌库旁。如果你检定失败，执行两者。
//   每个地点的隐藏值+1。
//   强制 - 当一轮结束时：从场上弃掉1张印斯茅斯之雾。(每轮最多一次。)
//
// 引擎读点：
//   · 「放到密谋牌库旁」= scenario-runtime 的 `putNextToAgenda`（真实旁置实例），成功时由
//     调查员二选一，失败时两者都执行——与 06194「阁楼的秘密」同一写法。
//   · 「每个地点的隐藏值+1」是**全局修正**：旁置卡是 entityModifierRows 的一条 `aside` 来源，
//     所有地点的 locationShroud 读点（engine/actions 的帷幕计算）都会叠加它。
//   · 轮末弃置 1 张：`treacheryRule.discardOneAtRoundEnd`（phases.js 的轮末旁置卡扫描，
//     同轮最多弃 1 张同名副本）。

export default {
  code: '07095', scope: 'treachery', implemented: true,
  treacheryRule: { discardOneAtRoundEnd: true },
  modifiers: [{ target: 'locationShroud', amount: 1 }],
  encounterResolve(state, inv, card, api) {
    let success = false
    // 场景运行时的 test 签名是 (seat, skill, difficulty, resolve, skillBonus, source, options)：
    // 第四个参数是结果回调，不是 options 对象。
    api.test(inv.seat, 'willpower', 3, result => { success = result.success === true },
      0, { name: card?.name || '印斯茅斯之雾', code: '07095', label: '显现检定', scenarioAbility: true })
    const place = () => {
      api.putNextToAgenda('07095')
      api.info?.('🌫️ 「印斯茅斯之雾」放在密谋牌库旁：每个地点的隐藏值 +1。')
    }
    if (!success) {
      api.horror(inv.seat, 1)
      place()
      return true
    }
    const answer = api.choice({
      kind: 'effect', source: '07095', seat: inv.seat,
      prompt: '印斯茅斯之雾：受到 1 点恐惧，或把它放到密谋牌库旁？',
      options: [{ id: 'horror', label: '受到 1 点恐惧' }, { id: 'place', label: '放到密谋牌库旁' }],
    })
    if (answer !== 'place') {
      api.horror(inv.seat, 1)
      return false
    }
    place()
    return true
  },
}
