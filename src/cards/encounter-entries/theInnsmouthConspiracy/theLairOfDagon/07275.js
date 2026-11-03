import { ALL_CARDS, hasTrait } from '../../_shared.js'

export default {
  code: '07275', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      api.mechanics.chaosTokens.add('curse', 2)
      if (api.mechanics.recordSets.values('memoriesRecovered').includes('AJailbreak')) {
        const location = state.locations.find(location => hasTrait(location, 'Third Floor'))
          || state.locations.find(location => (location.originalCode || location.code) === '07283')
        if (!location) return
        for (const code of (state.scenarioZones?.setAside || []).filter(code => hasTrait(ALL_CARDS[code], 'Suspect'))) {
          if (!api.takeFromSetAside(code)) continue
          const enemy = api.spawn(code, location.id)
          if (enemy) api.mechanics.keys.transfer('blue', 'setAside', `enemy:${enemy.id}`, { reveal: true })
        }
      } else {
        const lead = state.investigators[state.campaign.leadSeat]
        const here = state.locations.find(location => location.id === lead.location)
        const locations = state.locations.filter(location => here?.connections?.includes(location.id))
        const cultists = [...new Set(state.encounterDeck.filter(code => ALL_CARDS[code]?.type === 'enemy' && hasTrait(ALL_CARDS[code], 'Cultist')))]
        if (cultists.length && locations.length) {
          const code = cultists.length === 1 ? cultists[0] : api.choice({ kind: 'card', source: '07275', seat: lead.seat,
            prompt: '从遭遇牌库选择一名异教徒敌人，生成在连接地点。',
            options: cultists.map(code => ({ id: code, cardCode: code, label: ALL_CARDS[code].nameZh || ALL_CARDS[code].name })),
          })
          const id = locations.length === 1 ? locations[0].id : api.choice({ kind: 'location', source: '07275', seat: lead.seat,
            prompt: '选择与首位调查员所在地点连接的生成地点。',
            options: locations.map(location => ({ id: location.id, label: location.name })),
          })
          if (cultists.includes(code) && locations.some(location => location.id === id)) {
            const taken = api.takeEncounterDeckCard(code)
            if (taken) api.spawn(taken, id)
          }
        }
        api.shuffleEncounterDeck()
      }
    },
  },
}
