// 08661 疯狂的召唤 · 议程 3。背面的创伤或弱点选择由每位剩余调查员自己决定。
export default {
  code: '08661',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    onLeave(state, agenda, api) {
      const remaining = state.investigators.filter(inv => inv && !inv.defeated && !inv.resigned)
      for (const inv of remaining) {
        const tekeli = api.mechanics.tekeli
        const options = [{ id: 'trauma', label: '承受 1 点精神创伤' }]
        if (tekeli.size() >= 3) options.push({ id: 'tekeli', label: '将忒咳哩-哩牌库顶 3 张牌洗入你的牌库' })
        const answer = options.length > 1
          ? api.choice({ kind: 'effect', source: '08661', seat: inv.seat, prompt: '选择疯狂的召唤的败退后果。', options })
          : 'trauma'
        if (answer === 'tekeli') tekeli.shuffleIn(inv.seat, 3)
        else api.addTrauma(inv.seat, 'mental', 1)
        api.defeatInvestigator(inv.seat, { cause: 'madness' })
      }
    },
  },
}
