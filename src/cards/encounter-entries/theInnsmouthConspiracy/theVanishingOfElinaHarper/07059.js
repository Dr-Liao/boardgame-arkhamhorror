import { defeatedSuspectAgendaAbility, suspectCode, suspectRole } from '../../_shared.js'
export default {
  code: '07059', scope: 'agenda', implemented: true,
  abilities: [defeatedSuspectAgendaAbility({
    isKidnapper: (state, enemy) => suspectCode(state.campaign.records.harperSuspect) === (enemy.originalCode || enemy.code),
    recordValue: (state, enemy) => suspectRole(enemy.originalCode || enemy.code),
  })],
  agendaRule: { onReveal: (state, agenda, api) => api.finish('resolution1') },
}
