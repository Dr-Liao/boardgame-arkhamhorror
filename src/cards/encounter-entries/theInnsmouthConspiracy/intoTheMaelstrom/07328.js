import { hasTrait } from '../../_shared.js'
import { keysAt } from '../../_shared.js'

export default {
  code: '07328', scope: 'location',
  modifiers: [{
    target: 'locationShroud',
    condition: { when: ({ source, entity }) => source.revealed && source.id === entity.id },
    amount: ({ state }) => -state.locations.filter(location => hasTrait(location, 'Sanctum')
      && keysAt(state, `location:${location.id}`).length > 0).length,
  }],
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '达贡巢穴：记忆闪回XIV',
    limit: { scope: 'perGame', owner: 'group' },
    criteria: ({ state }) => Boolean(state.campaign?.records?.TheOrdersRitualWasDisrupted)
      && state.locations.reduce((sum, location) => sum + keysAt(state, `location:${location.id}`).length, 0) === 7,
    resolve: ({ inv, api }) => api.scenario.resolveFlashback(inv.seat, 'flashback14'),
  }],
}
