import { STORY_TEXT } from './story-text.js'
import { textBlocks } from './chapter-definition.js'
export function scenarioIntroduction(scenario,records={}) {
 const source=STORY_TEXT.zh.scenarios[scenario.id]
 let keys=['intro']
 if(scenario.id==='theVanishingOfElinaHarper')keys=['intro1','townInfo','intro2']
 if(scenario.id==='devilReef')keys=['intro1',records.TheMissionWasSuccessful?'intro2':'intro3']
 if(scenario.id==='theLairOfDagon')keys=['intro1',records.TheMissionWasSuccessful?'intro2':'intro3',(records.memoriesRecovered||[]).includes('ADecisionToStickTogether')?'intro4':'intro5']
 const sections=keys.map(key=>{const raw=source[key];if(!raw)throw new Error('Missing introduction '+scenario.id+'.'+key);return {title:typeof raw==='object'?raw.title||scenario.name:scenario.name,paragraphs:textBlocks(raw)}})
 return {version:3,title:scenario.name,sections,paragraphs:sections.flatMap(section=>section.paragraphs),code:scenario.referenceCode}
}
export function suppressIntroPresentation(state) {
 return state.scenario.id==='theVanishingOfElinaHarper'&&state.campaign.flow?.history?.some(visit=>visit.nodeId==='harperPreparation'&&visit.effectsApplied)
}
