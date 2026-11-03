import { symbolFailingRevelation } from '../../../_shared.js'
export default {
  code: '07097', scope: 'treachery', implemented: true,
  encounterResolve: symbolFailingRevelation({ code: '07097', skills: ['intellect'], difficulty: 3, token: 'tablet',
    onFailure: ({ inv, api }) => api.damage(inv.seat, 2) }),
}
