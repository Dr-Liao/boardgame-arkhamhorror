import { scenarioReferenceEntry } from '../../_shared.js'

export default scenarioReferenceEntry({
  code: '07311',
  scenarioRule: {
    resolveChaosToken(state, inv, token, api) {
      const hard = ['hard', 'expert'].includes(state.difficulty)
      const unflooded = state.locations.filter(location => location.traits?.includes("Y'ha-nthlei")
        && api.mechanics.water.level(location.id) === 0).length
      const delta = token === 'skull' ? -(unflooded >= 4 ? (hard ? 4 : 3) : (hard ? 2 : 1))
        : { cultist: hard ? -4 : -3, tablet: hard ? -5 : -4, elderthing: hard ? -6 : -5 }[token]
      if (delta == null) return null
      return { delta, onDraw: [], onFail: token === 'skull' ? [] : [{ type: 'scenarioToken', event: token }] }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'cultist') api.addDoom(1)
      else if (effect.event === 'tablet') {
        const canIncrease = state.locations.some(loc => loc.id === inv.location)
          && api.mechanics.water.canChange(inv.location, 1)
        const choice = canIncrease ? api.choose({
          kind: 'effect', source: '07311', seat: inv.seat, prompt: '提高所在地的水位，或受到1伤害。',
          options: [{ id: 'flood', label: '提高所在地水位' }, { id: 'damage', label: '受到1伤害' }],
        }) : 'damage'
        if (choice === 'flood') api.mechanics.water.change(inv.location, 1)
        else api.damage(inv.seat, 1)
      } else if (effect.event === 'elderthing'
        && state.locations.some(loc => loc.id === inv.location)
        && api.mechanics.keys.at(`location:${inv.location}`, { reveal: true }).length) api.horror(inv.seat, 1)
    },
  },
})
