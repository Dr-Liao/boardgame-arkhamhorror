import { STORY_TEXT } from './story-text.js'
import { textBlocks } from './chapter-definition.js'
import { awardExperience, campaignCardChange } from '../../../src/campaign/campaign.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
import { requestChoice } from '../../../src/engine/resolution.js'
import { recordSetAdd } from '../../../src/campaign/record-sets.js'

export const handlerId='innsmouthInterludes'
const memories=['AMeetingWithThomasDawson','ABattleWithAHorrifyingDevil','ADecisionToStickTogether','AnEncounterWithASecretCult','ADealWithJoeSargent','AFollowedLead','AnIntervention','AJailbreak','DiscoveryOfAStrangeIdol','DiscoveryOfAnUnholyMantle','DiscoveryOfAMysticalRelic','AConversationWithMrMoore','TheLifecycleOfADeepOne','AStingingBetrayal']
function present(state,event,key,log){
 const raw=STORY_TEXT.zh.base[event]?.[key]
 if(!raw)throw new Error(`Missing campaign story ${event}.${key}`)
 const text=textBlocks(raw).join('\n\n');log(text)
 const visit=state.campaign.flow?.history?.at(-1)
 if(visit)visit.storyText=[visit.storyText,text].filter(Boolean).join('\n\n')
}
function experience(state,amount,log){for(const record of Object.values(state.campaign.investigators)){awardExperience(state.campaign,record.seat,amount);log(`${record.name} 获得 ${amount} XP。`)}}
function addStoryCard(state,code,log){
 const campaign=state.campaign
 if(Object.values(campaign.investigators).some(inv=>inv.deck.includes(code)))return
 const candidates=Object.values(campaign.investigators).filter(inv=>inv.status==='active')
 if(!candidates.length)return
 const chosen=requestChoice(state,{kind:'storyCard',seat:campaign.leadSeat??0,source:code,prompt:'选择一位调查员将这张剧情资产加入牌组。',
  options:candidates.map(inv=>({id:String(inv.seat),label:inv.name,cardCode:code}))})
 campaignCardChange(campaign,Number(chosen),code,'add','innsmouthInterlude');log(`剧情卡已加入调查员牌组。`)
}
export function runInterludeEffect(state,{event},log){
 const campaign=state.campaign,records=campaign.records,recovered=records.memoriesRecovered||[]
 const show=key=>present(state,event,key,log)
 if(event==='prologue'){
  for(const value of ['BrianBurnham','BarnabasMarsh','OtheraGilman','ZadokAllen','JoyceLittle','RobertFriendly'])recordSetAdd(campaign,'possibleSuspects',value)
  for(const value of ['InnsmouthJail','ShorewardSlums','SawboneAlley','TheHouseOnWaterStreet','EsotericOrderOfDagon','NewChurchGreen'])recordSetAdd(campaign,'possibleHideouts',value)
 }else if(event==='prepareHarper'){
  const visit=campaign.flow?.history?.at(-1)
  for(const key of ['intro1','townInfo','intro2']){
   const text=textBlocks(STORY_TEXT.zh.scenarios.theVanishingOfElinaHarper[key]).join('\n\n');log(text)
   if(visit)visit.storyText=[visit.storyText,text].filter(Boolean).join('\n\n')
  }
 }else if(event==='interlude1'){
  show('part1')
  const reward=(memory,key)=>{if(recovered.includes(memory)){show(key);experience(state,1,log)}}
  reward(memories[0],'aMeetingWithThomasDawson')
  if(!recovered.length)show('noMemoriesRecovered')
  reward(memories[1],'aBattleWithAHorrifyingDevil');reward(memories[2],'aDecisionToStickTogether');reward(memories[3],'anEncounterWithASecretCult')
  show('part2')
 }else if(event==='interlude2'){
  show('theSyzygy1')
  if(records.TheMissionFailed)show('theSyzygy2')
  if(records.TheMissionWasSuccessful){show('theSyzygy3');addStoryCard(state,'07083',log)}
  show('theSyzygy4')
 }else if(event==='interlude3'){
  show('beneathTheWaves1')
  const keys=campaign.flowPayload?.recoveredKeys||[]
  for(const [color,key,token,record]of[['purple','purpleKey','cultist','TheIdolWasBroughtToTheLighthouse'],['white','whiteKey','tablet','TheMantleWasBroughtToTheLighthouse'],['black','blackKey','elderthing','TheHeaddressWasBroughtToTheLighthouse']])if(keys.includes(color)){
   show(key);experience(state,2,log);changeChaosBag(state,token,1,{permanent:true});records[record]=true
  }
  if(!keys.length)show('noKeys')
  show('beneathTheWaves2')
 }else if(event==='interlude4'){
  show('hiddenTruths')
  if(records.TheTerrorOfDevilReefIsDead&&recovered.includes('TheLifecycleOfADeepOne')){show('guardianDispatched');records.TheGuardianOfYhanthleiIsDispatched=true}
  if(records.TheGatekeeperHasBeenDefeated&&Object.values(campaign.investigators).some(inv=>['07179','07180','07181'].some(code=>inv.deck.includes(code)))){
   show('rightfulKeeper');records.TheGatewayToYhanthleiRecognizesYouAsTheRightfulKeeper=true
  }
  const owner=Object.values(campaign.investigators).find(inv=>inv.deck.includes('07083'))
  for(const inv of Object.values(campaign.investigators))for(const code of ['07082','07083'])if(inv.deck.includes(code))campaignCardChange(campaign,inv.seat,code,'remove','interlude4')
  if(owner){
   const choice=requestChoice(state,{kind:'storyCard',seat:owner.seat,source:'07083',prompt:'是否继续让艾莲娜·哈珀同行？',options:[{id:'keep',label:'继续同行'},{id:'leave',label:'各走各的路'}]})
   if(choice==='keep')campaignCardChange(campaign,owner.seat,'07083','add','interlude4')
  }
 }else if(event==='epilogue'){
  show('epilogue1')
  if(memories.every(memory=>recovered.includes(memory))){show('flashback15');records.TheHorribleTruth=true}
  else show('epilogue2')
 }else throw new Error('Unknown Innsmouth interlude '+event)
}
