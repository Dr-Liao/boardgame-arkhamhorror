// 11741 “克苏鲁弗坦！”（"Cthulhu fhtagn!"）· 诡计 · 共享遭遇组 domination（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/domination。
// 卡面（cards-data 11741）：
//   显现 - 检定[combat](3)。如果你失败，你必须受到2点恐惧，或对你所在地点一位调查员造成1点直接伤害。
//
// 读点（声明即接线）：
//   · 显现检定 = api.test；失败二选一 = api.choice；
//   · 「受到 2 点恐惧」= api.horror；「对所在地点一位调查员 1 点直接伤害」= api.directDamage
//     （scenario-runtime 的直接伤害入口；候选 = 与显现者同地点且未退场/未撤退的调查员，含自己，
//     与参考实现 investigatorAt iid 一致）。
const CODE = '11741'
const DIFFICULTY = 3

export default {
  code: CODE,
  name: '“克苏鲁弗坦！”',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Power'],
    quantity: 2,
    test: { skill: 'combat', difficulty: DIFFICULTY },
    failChoice: [{ horror: 2 }, { directDamageAtLocation: 1 }],
  },
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'combat', DIFFICULTY, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「克苏鲁弗坦！」检定（战斗 ${result.value} vs ${DIFFICULTY}）。`)
        return
      }
      const answer = String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '「克苏鲁弗坦！」：选择一项。',
        options: [
          { id: 'horror', label: '受到 2 点恐惧' },
          { id: 'damage', label: '对你所在地点一位调查员造成 1 点直接伤害' },
        ],
      }))
      if (answer !== 'damage') {
        api.horror(inv.seat, 2)
        api.info?.(`🐙 「克苏鲁弗坦！」：${inv.name} 受到 2 点恐惧。`)
        return
      }
      const targets = (state.investigators || []).filter(other =>
        !other.defeated && !other.resigned && other.location === inv.location)
      if (!targets.length) {
        api.horror(inv.seat, 2)
        api.info?.('🐙 「克苏鲁弗坦！」：没有可指定的同地点调查员，改为受到 2 点恐惧。')
        return
      }
      const targetAnswer = String(api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat,
        prompt: '「克苏鲁弗坦！」：选择所在地点一位调查员受到 1 点直接伤害。',
        options: targets.map(other => ({ id: String(other.seat), label: other.name })),
      }))
      const chosen = targets.find(other => String(other.seat) === targetAnswer) || targets[0]
      api.directDamage(chosen.seat, 1)
      api.info?.(`🐙 「克苏鲁弗坦！」：${inv.name} 对 ${chosen.name} 造成 1 点直接伤害。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '克苏鲁弗坦！' })
    return false
  },
  note: '显现检定失败后二选一：2 点恐惧，或对所在地点一位调查员（含自己）1 点直接伤害；'
    + '直接伤害走 api.directDamage（不经普通伤害分配）。没有同地点调查员时可选项只有恐惧。',
}
