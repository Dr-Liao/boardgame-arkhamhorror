import { SUSPECTS, HIDEOUTS } from './role-data.js'
import { recordSetRemove } from '../../../src/campaign/record-sets.js'
import { scenarioIntroduction, suppressIntroPresentation } from './introduction.js'
import { resolveChapter } from './resolutions.js'
import { resolveFlashback } from './flashbacks.js'
import { registeredEntry } from '../../../src/engine/ability.js'

// Stage readers dispatch to the physical card entry; no card text lives here.
export const entryRules = {
  introduction: scenarioIntroduction, suppressIntroPresentation,
  resolveChaosToken(state,inv,token,api) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.resolveChaosToken?.(state,inv,token,api)},
  applyTokenEffect(state,inv,effect,api) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.applyTokenEffect?.(state,inv,effect,api)},
  afterTest(state,inv,result,api,context) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.afterTest?.(state,inv,result,api,context)},
  testAutoFail(state,inv,context) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.testAutoFail?.(state,inv,context)===true},
  resolveFlashback,
  scenarioCardsSeen(state,deck,seat,cards) {
    if(deck!=='leads')return
    state.scenarioFlags.crossedOff ||= []
    for(const code of cards) {
      if(SUSPECTS[code])recordSetRemove(state.campaign,'possibleSuspects',SUSPECTS[code])
      if(HIDEOUTS[code])recordSetRemove(state.campaign,'possibleHideouts',HIDEOUTS[code])
      if(!state.scenarioFlags.crossedOff.includes(code))state.scenarioFlags.crossedOff.push(code)
    }
  },
  resolution: resolveChapter,
  cardAddedToHand(state,inv,code) {
    if(state.scenario.id!=='aLightInTheFog'||!['07179','07180','07181'].includes(code))return
    state.scenarioFlags.relicsAddedToHand ||= []
    if(!state.scenarioFlags.relicsAddedToHand.includes(code))state.scenarioFlags.relicsAddedToHand.push(code)
  },
  actReveal(state, act, api) {
    const rule = registeredEntry(act.originalCode || act.code)?.actRule
    if (typeof rule?.onReveal !== 'function') throw new Error(`Innsmouth act is not implemented: ${act.originalCode || act.code}`)
    return rule.onReveal(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    const rule = registeredEntry(agenda.originalCode || agenda.code)?.agendaRule
    if (typeof rule?.onReveal !== 'function') throw new Error(`Innsmouth agenda is not implemented: ${agenda.originalCode || agenda.code}`)
    return rule.onReveal(state, agenda, api)
  },
}
