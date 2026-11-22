const code = '60118'
const partners = (state, inv) => state.investigators.filter(other =>
  other.seat !== inv.seat && !other.defeated && !other.resigned && other.location === inv.location)

export default {
  code,
  playCondition: [({ state, inv, helpers }) => partners(state, inv).some(other =>
    helpers.canGainResources(other.seat) || helpers.canGainResources(inv.seat))],
  abilities: [{
    kind: 'played', label: '选择同地的另一位调查员，各获得 2 资源',
    resolve: ({ state, inv, api }) => {
      const options = partners(state, inv).filter(other => api.canGainResources(other.seat) || api.canGainResources(inv.seat))
      if (!options.length) return
      const chosen = options.length === 1 ? String(options[0].seat) : api.choice({
        kind: 'target', source: code, seat: inv.seat, prompt: '选择与谁共享资源。',
        options: options.map(other => ({ id: String(other.seat), label: other.name })),
      })
      const partner = options.find(other => String(other.seat) === chosen)
      if (!partner) return
      if (api.canGainResources(inv.seat)) api.gainResources(inv.seat, 2)
      if (api.canGainResources(partner.seat)) api.gainResources(partner.seat, 2)
    },
  }],
}
