import { scenarioReferenceEntry } from '../../_shared.js'

const harder = state => ['hard', 'expert'].includes(state.difficulty)

export default scenarioReferenceEntry({
  code: '07041',
  scenarioRule: {
    resolveChaosToken(state, inv, token, api) {
      const hard = harder(state)
      const delta = token === 'skull' ? -(1 + Number(hard) + api.mechanics.water.effectiveLevel(inv.seat))
        : { cultist: -2, tablet: -2, elderthing: -3 }[token]
      if (delta == null) return null
      const effects = token === 'skull' ? [] : [{ type: 'scenarioToken', event: token }]
      return { delta, onDraw: hard ? effects : [], onFail: hard ? [] : effects }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'cultist') {
        if (api.mechanics.water.effectiveLevel(inv.seat) > 0) api.damage(inv.seat, 1)
      } else if (effect.event === 'tablet') {
        if (api.mechanics.keys.at(`investigator:${inv.seat}`, { reveal: true }).length) api.horror(inv.seat, 1)
      } else if (effect.event === 'elderthing') {
        const enemy = api.mechanics.enemyZones.list('depths').find(card => (card.originalCode || card.code) === '07053')
        if (enemy) api.mechanics.enemyZones.restore('depths', enemy.id, { location: inv.location, engageSeat: inv.seat, exhausted: false })
      }
    },
  },
})
