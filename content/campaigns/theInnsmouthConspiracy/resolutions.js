import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { STORY_TEXT } from './story-text.js'
import { textBlocks } from './chapter-definition.js'
import { story } from './flashbacks.js'
import { awardStoryCard } from '../../../src/campaign/campaign-effects.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
const codeOf=card=>card.originalCode||card.code
function journal(state,keys){const sections=keys.map(key=>({title:key,paragraphs:textBlocks(STORY_TEXT.zh.scenarios[state.scenario.id].resolutions[key])}));return{version:3,title:state.scenario.name,sections,paragraphs:sections.flatMap(s=>s.paragraphs)}}
const actKeys=state=>Object.entries(state.scenarioFlags.mechanics?.keys||{}).filter(([,key])=>key.holder.startsWith('act:')).map(([color])=>color)
function addRecord(result,key,value=true){result.effects ||= [];result.effects.push({record:{[key]:value}})}
export function resolveChapter(state,key,events,api){
 const id=state.scenario.id,records=state.campaign.records,result={}
 const reached=[key]
 const show=next=>{if(!reached.includes(next)){story(state,api,'resolutions.'+next);reached.push(next)}}
 const redirect=next=>{show(next);key=next}
 if(id==='thePitOfDespair'){}
 else if(id==='theVanishingOfElinaHarper'){
  if(key==='noResolution')redirect('resolution1')
  addRecord(result,key==='resolution1'?'TheMissionFailed':'TheMissionWasSuccessful')
 }else if(id==='inTooDeep'){
  if(key==='noResolution')redirect('resolution1')
  result.bonus=records.TheInvestigatorsMadeItSafelyToTheirVehicles?2:0
 }else if(id==='devilReef'){
  if(key==='noResolution')redirect('resolution1')
  const terrorCodes=['07164b','07165b']
  if(state.agendaIndex===0||state.enemies.some(e=>terrorCodes.includes(codeOf(e))))addRecord(result,'TheTerrorOfDevilReefIsStillAlive')
  if(state.victoryDisplay.some(card=>terrorCodes.includes(codeOf(card))))addRecord(result,'TheTerrorOfDevilReefIsDead')
  const included=new Set([`act:${state.acts[state.actIndex].id}`,...state.investigators.map(inv=>`investigator:${inv.seat}`)])
  result.flowData={recoveredKeys:Object.entries(state.scenarioFlags.mechanics.keys).filter(([color,item])=>['purple','white','black'].includes(color)&&included.has(item.holder)).map(([color])=>color)}
 }else if(id==='horrorInHighGear'){
  addRecord(result,key==='resolution1'?'TheInvestigatorsReachedFalconPointBeforeSunrise':'TheInvestigatorsReachedFalconPointAfterSunrise')
 }else if(id==='aLightInTheFog'){
  if(key==='noResolution')redirect(state.agendaIndex<3?'resolution4':'resolution3')
  if(key==='resolution3'){result.award=false;result.effects=[{investigatorStatus:'killed',targets:'all',failed:true}]}
  else {
   if(key==='resolution1')for(const seat of state.scenarioFlags.resignedInMoonRoom||[]){const record=state.campaign.investigators[seat];if(record){record.records ||= {};record.records.PossessesADivingSuit=true}}
   const keys=actKeys(state)
   if(keys.includes('black'))addRecord(result,'TheInvestigatorsPossessAMapOfYhaNthlei')
   if(keys.includes('red'))addRecord(result,'TheInvestigatorsPossessTheKeyToYhaNthlei')
   for(const code of new Set(state.scenarioFlags.relicsAddedToHand||[]))if(['07179','07180','07181'].includes(code))awardStoryCard(state,code,'aLightInTheFog')
  }
 }else if(id==='theLairOfDagon'){
  if(key==='noResolution'){addRecord(result,'DagonHasAwakened');redirect('resolution1')}
  if(key==='resolution1'){
   if(state.victoryDisplay.some(card=>ALL_CARDS[codeOf(card)]?.traits?.includes('Suspect')))addRecord(result,'TheGatekeeperHasBeenDefeated')
   result.afterExperience=(state,api)=>{
    const next=api.choose({kind:'effect',seat:state.campaign.leadSeat??0,source:'oceiros',prompt:'告诉奥西罗斯什么？',options:[{id:'resolution2',label:'什么也不说'},{id:'resolution3',label:'对他说谎'},{id:'resolution4',label:'告诉他一切'}]})
    show(next);changeChaosBag(state,{resolution2:'elderthing',resolution3:'tablet',resolution4:'cultist'}[next],1,{permanent:true});result.story=journal(state,reached)
   }
  }else {result.award=false;changeChaosBag(state,{resolution2:'elderthing',resolution3:'tablet',resolution4:'cultist'}[key],1,{permanent:true})}
 }else if(id==='intoTheMaelstrom'){
  if(key==='noResolution')redirect('resolution8')
  if(key==='resolution8'){result.award=false;addRecord(result,'TheDeepOnesHaveFloodedTheEarth');result.effects.push({investigatorStatus:'killed',targets:'all',failed:true})}
  else if(key==='resolution1'){
   addRecord(result,'TheInvestigatorsEscapedYhanthlei')
   for(const enemy of [...state.enemies])if(['07330a','07330b','07331a','07331b'].includes(codeOf(enemy)))api.addEnemyToVictory(enemy)
   const completed=code=>state.victoryDisplay.some(card=>codeOf(card)===code)
   const stopped=completed('07316'),helped=completed('07317'),defied=completed('07318')
   result.bonus=stopped&&(helped||defied)?3:0
   result.effects.push({trauma:{physical:2},targets:'all'})
   if(stopped){show('resolution2');addRecord(result,'ThePlotOfTheDeepOnesWasThwarted');if(helped){show('resolution4');addRecord(result,'AgentHarpersMissionIsComplete')}else if(defied){show('resolution5');addRecord(result,'TheRichesOfTheDeepAreLostForever')}}
   else {show('resolution3');addRecord(result,'TheFloodHasBegun');show(helped?'resolution6':'resolution7');addRecord(result,helped?'AgentHarpersMissionIsCompleteButAtWhatCost':'TheRichesOfTheDeepAreLostForeverButAtWhatCost');result.effects.push({trauma:{mental:2},targets:'all',failed:true})}
  }else throw new Error('Final resolution must enter through resolution1 or resolution8')
 }else throw new Error('Unknown Innsmouth resolution chapter '+id)
 result.story=journal(state,reached)
 return result
}
