import { defeatedSuspectAgendaAbility } from '../../_shared.js'
import { suspectCode, suspectRole } from '../_shared/_roles.js'
export default {
  code: '07058', scope: 'agenda', implemented: true,
  abilities: [defeatedSuspectAgendaAbility({
    isKidnapper: (state, enemy) => suspectCode(state.campaign.records.harperSuspect) === (enemy.originalCode || enemy.code),
    recordValue: (state, enemy) => suspectRole(enemy.originalCode || enemy.code),
  })],
  agendaRule: { onReveal: (state, agenda, api) => api.finish('resolution1') },
}
