import { STORY_TEXT } from './story-text.js'
import { recordSetAdd } from '../../../src/campaign/record-sets.js'

const FLASHBACKS = {
  flashback1: ['thePitOfDespair','AMeetingWithThomasDawson'],
  flashback2: ['thePitOfDespair','ABattleWithAHorrifyingDevil','cultist'],
  flashback3: ['thePitOfDespair','ADecisionToStickTogether','tablet'],
  flashback4: ['thePitOfDespair','AnEncounterWithASecretCult','elderthing'],
  flashback5: ['inTooDeep','ADealWithJoeSargent'],
  flashback6: ['inTooDeep','AFollowedLead'],
  flashback7: ['inTooDeep','AnIntervention'],
  flashback8: ['inTooDeep','AJailbreak'],
  flashback9: ['devilReef','DiscoveryOfAStrangeIdol'],
  flashback10: ['devilReef','DiscoveryOfAnUnholyMantle'],
  flashback11: ['devilReef','DiscoveryOfAMysticalRelic'],
  flashback12: ['aLightInTheFog','AConversationWithMrMoore'],
  flashback13: ['aLightInTheFog','TheLifecycleOfADeepOne'],
}
export function story(state, api, id, { scenario = state.scenario.id, locale = 'zh' } = {}) {
  const raw = id.split('.').reduce((value,key)=>value?.[key], STORY_TEXT[locale]?.scenarios?.[scenario])
  if (!raw) throw new Error(`Missing Innsmouth story ${scenario}.${id}`)
  const html = typeof raw === 'string' ? raw : raw.body
  if (typeof html !== 'string') throw new Error(`Missing Innsmouth story body ${scenario}.${id}`)
  const text = html.replace(/<\/(?:p|div|ul|h[1-6])>/g,'\n\n').replace(/<li>/g,'\n• ').replace(/<br\s*\/?>/g,'\n')
    .replace(/<[^>]+>/g,'').replaceAll('&nbsp;',' ').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
    .replace(/\n{3,}/g,'\n\n').trim()
  api.present(text, { kind: 'story', title: typeof raw === 'string' ? id : raw.title || id, text })
}
function changePermanentToken(state, token, amount) {
  state.campaign.chaosBag ||= [...state.chaosBag]
  if (amount > 0) { state.chaosBag.push(token); state.campaign.chaosBag.push(token); return true }
  const index=state.chaosBag.indexOf(token)
  if (index < 0) return false
  state.chaosBag.splice(index,1)
  const permanent=state.campaign.chaosBag.indexOf(token)
  if (permanent >= 0) state.campaign.chaosBag.splice(permanent,1)
  return true
}
function removeChosenSymbol(state, seat, api) {
  const tokens=['cultist','tablet','elderthing'].filter(token=>state.chaosBag.includes(token))
  if (!tokens.length) return false
  const token=tokens.length===1?tokens[0]:api.choose({ kind:'effect',seat,source:'flashback',prompt:'永久移除袋中的一个混乱标记。',
    options:tokens.map(token=>({id:token,label:api.tokenLabel(token)})) })
  return changePermanentToken(state,token,-1)
}
function chooseLocalInvestigator(state, seat, api, printedCode) {
  const location=state.locations.find(loc=>(loc.originalCode||loc.code)===printedCode)
  const candidates=state.investigators.filter(inv=>!inv.defeated&&!inv.resigned&&inv.location===location?.id)
  if (!candidates.length) return null
  return candidates.length===1?candidates[0].seat:Number(api.choose({kind:'investigator',seat,source:'flashback',prompt:'选择一位在此处的调查员。',
    options:candidates.map(inv=>({id:String(inv.seat),label:inv.name}))}))
}
export function resolveFlashback(state, seat, id, api) {
  const spec=FLASHBACKS[id]
  if (!spec || spec[0]!==state.scenario.id) throw new Error(`Unknown flashback ${state.scenario.id}.${id}`)
  const inv=state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  state.scenarioFlags.resolvedFlashbacks ||= []
  if (state.scenarioFlags.resolvedFlashbacks.includes(id)) return false
  state.scenarioFlags.resolvedFlashbacks.push(id)
  story(state,api,id)
  recordSetAdd(state.campaign,'memoriesRecovered',spec[1])
  if(spec[2])changePermanentToken(state,spec[2],-1)
  if(id==='flashback5') {
    const owner=chooseLocalInvestigator(state,seat,api,'07139')
    if(owner!=null&&api.takeFromSetAside('07150'))api.giveAsset(owner,'07150',{uses:3,usesType:'ticket'})
  }
  if(id==='flashback6') {
    const answer=api.choose({kind:'effect',seat,source:id,prompt:'是否带上深潜者的教诲？',options:[{id:'decline',label:'放下教诲'},{id:'take',label:'带上教诲'}]})
    if(answer==='take') {
      const owner=chooseLocalInvestigator(state,seat,api,'07135')
      if(owner!=null&&api.takeFromSetAside('07151')) {api.campaignCard('07151',owner,'恢复的记忆');api.giveAsset(owner,'07151')}
    }
  }
  if(id==='flashback7')changePermanentToken(state,'+1',1)
  if(['flashback8','flashback12','flashback13'].includes(id))removeChosenSymbol(state,seat,api)
  if(id==='flashback12')api.gainClues(state.campaign.leadSeat??0,state.numInvestigators)
  if(['flashback9','flashback10','flashback11'].includes(id)) {
    const [color,code]={flashback9:['purple','07179'],flashback10:['white','07180'],flashback11:['black','07181']}[id]
    if(!api.mechanics.keys.transfer(color,`location:${inv.location}`,`investigator:${seat}`,{reveal:true}))throw new Error('Flashback relic key is absent')
    if(!api.takeFromSetAside(code))throw new Error('Flashback physical relic is absent')
    const asset=api.giveAsset(seat,code)
    api.mechanics.keys.linkAsset(color,asset.id)
  }
  return true
}
