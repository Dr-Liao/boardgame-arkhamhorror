import { symbolFailingRevelation } from '../../../_shared.js'
export default {
  code: '07096', scope: 'treachery', implemented: true,
  encounterResolve: symbolFailingRevelation({ code: '07096', skills: ['willpower'], difficulty: 3, token: 'cultist',
    onFailure: ({ inv, api }) => api.horror(inv.seat, 2) }),
}
