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
  // 全员撤退：引擎先给当前幕一次「目标已达成」的结算机会，再走默认 noResolution。
  // 条目在 `actRule.allResigned` 声明（数据驱动分派，内容层不写卡号分支）。
  allResigned(state, api) {
    const act = state.acts?.[state.actIndex]
    const rule = registeredEntry(act?.originalCode || act?.code)?.actRule
    return rule?.allResigned?.(state, act, api)
  },
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
  // 议程正面「进行期间的持续/静默强制」：条目在 `agendaRule.phaseBegan` 声明，内容层只做
  // 数据驱动分派（读点：turn.js#phaseBeginningWindow），不在内容层写卡号分支。
  phaseBegan(state, phase, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    const rule = registeredEntry(agenda?.originalCode || agenda?.code)?.agendaRule
    rule?.phaseBegan?.(state, agenda, phase, api)
  },
}
