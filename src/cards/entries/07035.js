// Predestined — any skill type, at most one per test; its owner chooses after failure.
export default { code: '07035', abilities: [{ kind: 'commit', label: '失败后加入祝福或移除诅咒', skill: {
  anySkill: true, maxPerTest: 1,
  onFail: ({ inv, result, state, api }) => {
    if (!result || result.success) return
    const options = []
    if (api.chaosTokens.room('bless') > 0) options.push({ id: 'bless', label: '加入2个祝福' })
    // 印刷是「移除 2 个诅咒」：只有 1 个时不能把「移除 2 个」降级成「移除 1 个」（审计 M31）。
    const curses = state.chaosBag.filter(token => token === 'curse').length
    if (curses >= 2) options.push({ id: 'curse', label: '移除2个袋内诅咒' })
    if (!options.length) return
    const answer = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '07035', seat: inv.seat,
      prompt: '宿命：选择一种效果。', options })
    if (answer === 'bless') api.chaosTokens.add('bless', 2)
    else if (answer === 'curse') api.chaosTokens.pay('curse', 2)
  },
} }] }
