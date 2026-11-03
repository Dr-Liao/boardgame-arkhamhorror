import { ALL_CARDS, hasTrait } from '../../_shared.js'

export default {
  code: '07276', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      const tokens = api.mechanics.chaosTokens
      tokens.pay('curse', Math.min(2, tokens.candidates('curse').length))
      const jailbroke = api.mechanics.recordSets.values('memoriesRecovered').includes('AJailbreak')
      if (!jailbroke) return
      const location = state.locations.find(location => hasTrait(location, 'Third Floor'))
        || state.locations.find(location => (location.originalCode || location.code) === '07283')
      if (!location) return
      const suspects = (state.scenarioZones?.setAside || []).filter(code => hasTrait(ALL_CARDS[code], 'Suspect'))
      for (const code of suspects) {
        if (!api.takeFromSetAside(code)) continue
        api.spawn(code, location.id, { exhausted: true })
      }
    },
  },
}
