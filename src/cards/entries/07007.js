export default {
  code: '07007', abilities: [{ kind: 'weakness', label: '每个袋内祝福：替换为诅咒或承受恐惧', weakness: { type: 'custom' },
    resolve: ({ inv, state, api }) => {
      const count = state.chaosBag.filter(token => token === 'bless').length
      for (let i = 0; i < count; i++) {
        const id = api.choice({ kind: 'effect', source: '07007', seat: inv.seat, prompt: `处理第 ${i + 1} 个祝福。`,
          options: [{ id: 'curse', label: '替换为诅咒' }, { id: 'horror', label: '承受 1 恐惧，保留祝福' }] })
        if (id === 'curse') api.chaosTokens.replace('bless', 'curse', 1)
        else api.horror(inv.seat, 1)
      }
    } }],
}
