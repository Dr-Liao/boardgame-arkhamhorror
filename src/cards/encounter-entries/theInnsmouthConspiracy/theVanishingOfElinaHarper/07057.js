import { defeatedSuspectAgendaAbility } from '../../_shared.js'
import { suspectCode, suspectRole } from '../_shared/_roles.js'
export default {
  code: '07057', scope: 'agenda', implemented: true,
  abilities: [defeatedSuspectAgendaAbility({
    isKidnapper: (state, enemy) => suspectCode(state.campaign.records.harperSuspect) === (enemy.originalCode || enemy.code),
    recordValue: (state, enemy) => suspectRole(enemy.originalCode || enemy.code),
  })],
  agendaRule: {
    onReveal(state, agenda, api) {
      const added = []
      for (const code of ['07094', '01172']) while (api.takeFromSetAside(code)) added.push(code)
      api.shuffleIntoEncounterDeck(added, { shuffle: false })
      api.shuffleDiscard()
      if (!(state.campaign.records.memoriesRecovered || []).includes('ADecisionToStickTogether')) return
      const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!candidates.length || !state.scenarioZones.setAside.includes('07082')) return
      const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({ kind: 'investigator',
        source: '07057', seat: state.campaign.leadSeat, prompt: '选择一位调查员控制不占盟友槽的托马斯·道森。',
        options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })) }))
      if (api.takeFromSetAside('07082')) {
        const asset = api.giveAsset(seat, '07082')
        if (asset) api.exemptAssetSlot(asset, 'ally')
      }
    },
  },
}
