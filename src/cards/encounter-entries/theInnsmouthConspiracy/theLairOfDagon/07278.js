export default {
  code: '07278', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const tokens = api.mechanics.chaosTokens
      tokens.pay('curse', Math.min(4, tokens.candidates('curse').length))
      const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!candidates.length) return
      const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({ kind: 'investigator', source: '07278', seat: state.campaign.leadSeat,
        prompt: '选择一名调查员取得预留的托马斯·道森（不占盟友槽位）。',
        options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      if (!candidates.some(inv => inv.seat === seat)) return
      if (api.takeFromSetAside('07082')) {
        const dawson = api.giveAsset(seat, '07082')
        if (dawson) api.exemptAssetSlot(dawson, 'ally')
      }
      const keys = api.mechanics.keys.at('reference')
      if (!keys.length) return
      const color = api.mechanics.interactions.chooseKey(seat, keys, { optional: true, source: '07278' })
      if (keys.includes(color)) api.mechanics.keys.transfer(color, 'reference', `investigator:${seat}`, { reveal: true })
    },
  },
}
