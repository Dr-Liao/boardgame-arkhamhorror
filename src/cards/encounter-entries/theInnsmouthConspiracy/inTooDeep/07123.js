import { scenarioReferenceEntry } from '../../_shared.js'

const harder = state => ['hard', 'expert'].includes(state.difficulty)

export default scenarioReferenceEntry({
  code: '07123',
  scenarioRule: {
    resolveChaosToken(state, inv, token, api) {
      const hard = harder(state)
      const origin = api.mechanics.map.position(inv.location)
      const east = origin && !origin.isolated ? state.locations.filter(loc => {
        const position = api.mechanics.map.position(loc.id)
        return position && !position.isolated && position.y === origin.y && position.x > origin.x
      }).length : 0
      const connected = state.locations.find(loc => loc.id === inv.location)?.connections || []
      const barriers = api.mechanics.barriers.edges(inv.location)
        .filter(edge => connected.includes(edge.a === inv.location ? edge.b : edge.a))
        .reduce((count, edge) => count + edge.count, 0)
      const delta = token === 'skull' ? -east * (hard ? 2 : 1)
        : token === 'elderthing' ? -barriers * (hard ? 2 : 1)
          : { cultist: hard ? -4 : -2, tablet: hard ? -5 : -3 }[token]
      if (delta == null) return null
      return { delta, onDraw: [], onFail: ['cultist', 'tablet'].includes(token)
        ? [{ type: 'scenarioToken', event: token }] : [] }
    },
    applyTokenEffect(state, inv, effect, api) {
      const origin = api.mechanics.map.position(inv.location)
      const connected = state.locations.find(loc => loc.id === inv.location)?.connections || []
      if (effect.event === 'cultist') {
        const destination = connected.find(id => {
          const position = api.mechanics.map.position(id)
          return position && !position.isolated && origin && !origin.isolated
            && position.y === origin.y && position.x === origin.x + 1
        })
        if (destination) api.moveInvestigator(inv.seat, destination, { ignoreBarriers: true })
      } else if (effect.event === 'tablet') {
        const candidates = connected.filter(id => api.mechanics.barriers.count(inv.location, id) === 0
          && api.mechanics.barriers.canPlace(inv.location, id))
        if (!candidates.length) return
        const id = candidates.length === 1 ? candidates[0] : api.choose({
          kind: 'location', source: '07123', seat: inv.seat, prompt: '选择连接且与你所在地之间没有路障的地点。',
          options: candidates.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })),
        })
        api.mechanics.barriers.change(inv.location, id, 1)
      }
    },
  },
})
