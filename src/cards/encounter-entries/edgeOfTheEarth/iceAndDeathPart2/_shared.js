function chooseAmount(api, inv, code, max, prompt, verb) {
  if (max <= 0) return 0
  const answer = api.choice({
    kind: 'effect', source: code, seat: inv.seat, prompt,
    options: Array.from({ length: max + 1 }, (_, amount) => ({
      id: String(amount), label: verb + ' ' + amount,
    })),
  })
  return Number(answer) || 0
}

export function possessedRescueAbility(rule) {
  const { code, label, thresholdPerInvestigator } = rule
  return {
    kind: 'action',
    actionKind: 'parley',
    cost: { action: 1 },
    label,
    resolve: ({ state, inv, source, api }) => {
      const finish = amount => {
        if (amount <= 0 || !state.enemies.some(enemy => enemy.id === source.id)) return
        const threshold = thresholdPerInvestigator * state.numInvestigators
        const total = api.placeResourceOnCard(source, amount)
        if (total >= threshold) api.scenario.addEnemyToVictory(source)
      }
      if (rule.kind === 'discardForResources') {
        let discarded = 0
        while (discarded < rule.maxDiscard && api.chooseOptionalHandDiscard(inv.seat, code)) discarded++
        finish(discarded)
        return
      }
      if (rule.kind === 'drawTekeliliForResources') {
        const max = Math.min(rule.maxDraw, api.mechanics.tekeli.size())
        const count = chooseAmount(api, inv, code, max, '选择从忒咳哩-哩牌库抽取的张数', '抽取')
        let drawn = 0
        while (drawn < count && !inv.defeated && api.resolveTekeliTop(inv.seat)) drawn++
        finish(drawn)
        return
      }
      if (rule.kind === 'spendResources') {
        const max = Math.min(rule.maxSpend, api.availableResources(inv))
        const amount = chooseAmount(api, inv, code, max, '选择谈判时花费的资源数', '花费')
        finish(api.spendResources(inv.seat, amount))
        return
      }
      const skill = rule.skills ? api.choice({
        kind: 'effect', source: code, seat: inv.seat, prompt: '选择谈判检定的技能',
        options: rule.skills.map(id => ({ id, label: {
          willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷',
        }[id] })),
      }) : rule.skill
      api.test(inv.seat, skill, rule.difficulty, {
        actionKind: 'parley',
        source: { type: 'scenario', actionKind: 'parley', code, enemyId: source.id, ability: true },
        resolve: result => {
          if (!result.success) {
            api.enemyAttackByCard(source, '谈判失败', inv.seat)
            return
          }
          const margin = Math.max(0, result.value - result.difficulty)
          finish(rule.perOverSuccess ? margin : rule.flatOnSuccess)
        },
      })
    },
  }
}
