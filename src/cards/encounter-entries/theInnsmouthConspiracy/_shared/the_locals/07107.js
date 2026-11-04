// 07107 鬼祟的当地人 · 涨潮
//
// 印刷（中文）：
//   显现 - 检定[intellect](3)。如果你检定成功，受到1点伤害，或将「鬼祟的当地人」放置入场，
//          放到密谋牌库旁。如果你检定失败，执行两者。
//   调查员不能谈判。
//   强制 - 当一轮结束时：从场上弃掉1张鬼祟的当地人。(每轮最多一次。)
//
// 引擎读点：
//   · 「放到密谋牌库旁」= `putNextToAgenda`（真实旁置实例），失败时两者都执行（与 07095 同形）。
//   · 「调查员不能谈判」是**全局能力禁止**：旁置卡在 modifierSourceRows 里是一条没有控制者的
//     来源，声明 `audience: 'all'` 的修正对所有人生效；读点是 parley.js 的 parleyForbidden
//     （合法行动与执行前校验共用），因此它是 `capability:parley` 而不是新的规则键。
//   · 轮末弃置 1 张：`treacheryRule.discardOneAtRoundEnd`。

export default {
  code: '07107', scope: 'treachery', implemented: true,
  treacheryRule: { discardOneAtRoundEnd: true },
  modifiers: [{ target: 'capability:parley', audience: 'all' }],
  encounterResolve(state, inv, card, api) {
    let success = false
    // 场景运行时的 test 签名是 (seat, skill, difficulty, resolve, skillBonus, source, options)。
    api.test(inv.seat, 'intellect', 3, result => { success = result.success === true },
      0, { name: card?.name || '鬼祟的当地人', code: '07107', label: '显现检定', scenarioAbility: true })
    const place = () => {
      api.putNextToAgenda('07107')
      api.info?.('🕵️ 「鬼祟的当地人」放在密谋牌库旁：本轮所有调查员不能谈判。')
    }
    if (!success) {
      api.damage(inv.seat, 1)
      place()
      return true
    }
    const answer = api.choice({
      kind: 'effect', source: '07107', seat: inv.seat,
      prompt: '鬼祟的当地人：受到 1 点伤害，或把它放到密谋牌库旁？',
      options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'place', label: '放到密谋牌库旁' }],
    })
    if (answer !== 'place') {
      api.damage(inv.seat, 1)
      return false
    }
    place()
    return true
  },
}
