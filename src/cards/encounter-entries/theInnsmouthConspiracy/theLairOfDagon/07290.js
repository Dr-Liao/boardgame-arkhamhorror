export default {
  code: '07290', scope: 'location',
  locationRule: {
    onReveal(state, location, api, seat) {
      const most = Math.max(...state.locations.map(candidate => candidate.clues || 0))
      const choices = state.locations.filter(candidate => (candidate.clues || 0) === most)
      if (!choices.length) return
      const id = choices.length === 1 ? choices[0].id : api.choice({ kind: 'location', source: '07290', seat: seat ?? state.campaign.leadSeat,
        prompt: '选择线索最多的一处地点，放置预留的绿色钥匙。',
        options: choices.map(candidate => ({ id: candidate.id, label: candidate.name })),
      })
      if (choices.some(candidate => candidate.id === id)) api.mechanics.keys.transfer('green', 'setAside', `location:${id}`, { reveal: true })
    },
  },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '本地点共同花费绿色钥匙和每人3个线索：解锁最终深处',
    cost: { groupClues: ({ state }) => 3 * state.numInvestigators },
    additionalKeyCost: { colors: ['green'], scope: 'here' },
    criteria: ({ state }) => !state.scenarioFlags?.remembered?.includes('UnlockedTheFinalDepths'),
    resolve: ({ api }) => api.scenario.remember('UnlockedTheFinalDepths'),
  }],
}
