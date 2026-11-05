export default {
  code: '07007', abilities: [{ kind: 'weakness', label: '每个袋内祝福：替换为诅咒或承受恐惧', weakness: { type: 'custom' },
    resolve: ({ inv, state, api }) => {
      const count = state.chaosBag.filter(token => token === 'bless').length
      for (let i = 0; i < count; i++) {
        // 池满（10 枚）时不能替换：印刷效果是「替换为诅咒」，替换后物理池守恒，
        // 修复前仍提供该选项、结果祝福被移除却加不进诅咒（审计 M5）。
        const options = [{ id: 'horror', label: '承受 1 恐惧，保留祝福' }]
        if (api.chaosTokens.room('curse') > 0) options.unshift({ id: 'curse', label: '替换为诅咒' })
        const id = options.length === 1 ? options[0].id
          : api.choice({ kind: 'effect', source: '07007', seat: inv.seat, prompt: `处理第 ${i + 1} 个祝福。`, options })
        if (id === 'curse') api.chaosTokens.replace('bless', 'curse', 1, { exact: true })
        else api.horror(inv.seat, 1)
      }
    } }],
}
