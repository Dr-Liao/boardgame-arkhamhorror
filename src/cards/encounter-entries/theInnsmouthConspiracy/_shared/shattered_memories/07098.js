import { symbolFailingRevelation, failedBy } from '../../../_shared.js'
export default {
  code: '07098', scope: 'treachery', implemented: true,
  encounterResolve: symbolFailingRevelation({ code: '07098', skills: ['willpower', 'intellect'], difficulty: 4, token: 'elderthing',
    onFailure: ({ inv, api, result }) => api.discardChosen(inv.seat, failedBy(result, 4), '07098') }),
}
