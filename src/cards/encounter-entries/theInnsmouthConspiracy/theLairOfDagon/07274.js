import { scenarioReferenceEntry } from '../../_shared.js'

export default scenarioReferenceEntry({
  code: '07274',
  scenarioRule: {
    resolveChaosToken(state, inv, token, api) {
      const hard = ['hard', 'expert'].includes(state.difficulty)
      const delta = token === 'skull'
        ? -api.mechanics.keys.at('reference', { reveal: true }).length * (hard ? 2 : 1)
        : { cultist: hard ? -2 : 0, tablet: -3, elderthing: -4 }[token]
      if (delta == null) return null
      const effect = token === 'tablet' ? { type: 'scenarioToken', event: 'dropKeys', damage: Number(hard) }
        : token === 'elderthing' ? { type: 'scenarioToken', event: 'addCurse', amount: hard ? 2 : 1 } : null
      return { delta, drawAnother: token === 'cultist',
        onDraw: hard && effect ? [effect] : [], onFail: !hard && effect ? [effect] : [] }
    },
    applyTokenEffect(state, inv, effect, api) {
      if (effect.event === 'dropKeys') {
        if (!state.locations.some(loc => loc.id === inv.location)) return
        for (const color of api.mechanics.keys.at(`investigator:${inv.seat}`, { reveal: true })) {
          api.mechanics.keys.transfer(color, `investigator:${inv.seat}`, `location:${inv.location}`, { reveal: true })
        }
        if (effect.damage) api.damage(inv.seat, effect.damage)
      } else if (effect.event === 'addCurse') api.mechanics.chaosTokens.add('curse', effect.amount)
    },
    testAutoFail(state, inv, context) {
      // Cultist must retain its scenario effect; a curse that was revealed
      // anywhere in this test counts even when only its effects are ignored.
      return !context.ignoredSymbols && context.resolvedTokens.includes('cultist')
        && context.drawn.includes('curse')
    },
  },
})
