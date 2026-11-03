import { scenarioReferenceEntry } from '../../_shared.js'

const harder = state => ['hard', 'expert'].includes(state.difficulty)

function passengerLoss(state, inv, api, resource, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError('Missing normalized failedBy')
  const lose = (seat, count) => {
    if (resource) api.loseResources(seat, count)
    else {
      const location = state.locations.find(loc => loc.id === inv.location)
      if (!location) return
      const moved = api.loseClues(seat, count)
      if (moved) api.addCluesToLocation(location.id, moved)
    }
  }
  for (let remaining = amount; remaining > 0; remaining--) {
    const vehicleId = api.mechanics.vehicles.of(inv.seat)
    const vehicle = state.scenarioFlags.mechanics.vehicles?.[vehicleId]
    if (!vehicle) return
    const candidates = vehicle.passengers.map(seat => state.investigators[seat])
      .filter(other => other && !other.defeated && !other.resigned
        && (resource ? other.resources : other.clues) > 0)
    if (!candidates.length) return
    const held = other => resource ? other.resources : other.clues
    if (candidates.length === 1) {
      lose(candidates[0].seat, Math.min(remaining, held(candidates[0])))
      return
    }
    if (candidates.reduce((total, other) => total + held(other), 0) <= remaining) {
      for (const other of candidates) lose(other.seat, held(other))
      return
    }
    const seat = Number(api.choose({
      kind: 'investigator', seat: inv.seat, source: '07198',
      prompt: resource ? '选择车内一位调查员失去1资源。' : '选择车内一位调查员将1线索放在你所在地。',
      options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
    }))
    lose(seat, 1)
  }
}

export default scenarioReferenceEntry({
  code: '07198',
  scenarioRule: {
    resolveChaosToken(state, inv, token) {
      const hard = harder(state)
      const fewRoads = state.scenarioFlags.mechanics.road.deck.length <= 6
      const delta = token === 'skull' ? -(fewRoads ? hard ? 4 : 3 : hard ? 2 : 1)
        : { cultist: hard ? -2 : -1, tablet: hard ? -3 : -2, elderthing: -4 }[token]
      if (delta == null) return null
      return {
        delta,
        onDraw: hard && token === 'elderthing' ? [{ type: 'scenarioToken', event: 'hunters' }] : [],
        onFail: ['cultist', 'tablet'].includes(token) ? [{ type: 'scenarioToken', event: token }]
          : !hard && token === 'elderthing' ? [{ type: 'scenarioToken', event: 'hunters' }] : [],
      }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'cultist') passengerLoss(state, inv, api, false, effect.test.failedBy)
      else if (effect.event === 'tablet') passengerLoss(state, inv, api, true, effect.test.failedBy)
      else if (effect.event === 'hunters') api.resolveHunterMoves({ source: '07198' })
    },
  },
})
