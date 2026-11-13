// 09725 黑暗中的身影（Figures in the Dark） · 诡计 · dark_veiling
// 归属：战役共用 · theScarletKeys/_shared/darkVeiling。
// 卡面：险境。显现 - 如果阴影中没有敌人，黑暗中的身影获得涌动。否则，你必须决定（选择一项）：
//   - 阴影中的每个敌人攻击你。
//   - 每位调查员失去一个行动。
//   Peril. Revelation - If there are no enemies in the shadows, Figures in the Dark gains surge.
//   Otherwise, you must decide (choose one): Each enemy in the shadows attacks you. / Each investigator
//   loses an action.
// 读点：
//   · 「阴影中的敌人」= 该敌人有一张未揭露的非诱饵迷你卡（kind === 敌人卡号）；只读，不泄露身份；
//   · 「获得涌动」= encounterResolve 返回 { gainSurge: true }；
//   · 敌人攻击 = api.attack（敌人攻击的唯一结算入口，含伤害分配与反应窗口）；
//   · 失去行动 = api.loseActions（含 wouldLoseActions 取消窗口与阶段口径）；
//   · 险境由卡面数据提供（card-data 的 peril 解析）。
const CODE = '09725'

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const cards = miniCardsIn(state)
    const miniKind = code => `enemy${code}` // 迷你卡 kind 只允许字母开头，敌人真身记作 enemy<卡号>
    const enemyKinds = new Set(state.enemies.map(enemy => miniKind(enemy.originalCode || enemy.code)))
    const kindsInShadows = new Set(cards.filter(entry => !entry.decoy && enemyKinds.has(entry.kind)).map(entry => entry.kind))
    if (!kindsInShadows.size) {
      api.info?.('「黑暗中的身影」：阴影中没有敌人，获得涌动。')
      return { gainSurge: true }
    }
    const answer = api.choose({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '黑暗中的身影：阴影中的每个敌人攻击你，或每位调查员失去一个行动。',
      options: [
        { id: 'attacks', label: '阴影中的每个敌人攻击我' },
        { id: 'actions', label: '每位调查员失去一个行动' },
      ],
    })
    if (answer === 'actions') {
      for (const owner of state.investigators) {
        if (owner.defeated || owner.resigned) continue
        api.loseActions(owner.seat, 1)
      }
      api.info?.('🌑 每位调查员失去了 1 个行动。')
      return false
    }
    const shadows = state.enemies.filter(enemy => kindsInShadows.has(miniKind(enemy.originalCode || enemy.code)))
    for (const enemy of shadows) {
      if (inv.defeated || inv.resigned) break
      api.attack(enemy, inv)
    }
    api.info?.(`🌑 阴影中的 ${shadows.length} 个敌人攻击了 ${inv.name}。`)
    return false
  },
  note: 'approximation: 「阴影中的敌人」按「该敌人有未揭露的非诱饵迷你卡」判定（tsk-concealed 不提供'
    + '敌人在阴影中的独立状态位，迷你卡即在阴影）；攻击/失去行动都走既有唯一结算入口。',
}
