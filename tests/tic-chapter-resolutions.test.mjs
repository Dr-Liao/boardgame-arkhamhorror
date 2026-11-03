import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
function finish(s,key,select=()=>null){
 const execute=d=>{try{scenarioRuntime(d,[]).finish(key)}catch(e){if(e.constructor.name!=='ScenarioEnded')throw e}}
 resolveTransaction(s,0,{action:'testTicResolution'},execute)
 for(let guard=0;s.pendingChoice;guard++){assert.ok(guard<80);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:select(c)??c.options.find(o=>['skip','done','self'].includes(o.id))?.id??c.options[0].id},execute)}
 return execute
}
function board(id,count=2){const s=chapterFixture(id,count);s.victoryDisplay=[];for(const loc of s.locations)delete loc.victory;return s}
for(const id of ['thePitOfDespair','theVanishingOfElinaHarper','inTooDeep','devilReef'])test(`P7 ${id} true noResolution reaches its declared source result without an unknown-result error`,()=>{
 const s=board(id);finish(s,'noResolution');assert.equal(s.campaign.scenarioResults.length,1)
 assert.equal(s.campaign.pendingNode,{thePitOfDespair:'interlude1',theVanishingOfElinaHarper:'interlude2',inTooDeep:'devilReef',devilReef:'interlude3'}[id])
 if(id==='theVanishingOfElinaHarper')assert.equal(s.campaign.records.TheMissionFailed,true)
})
for(const safe of [false,true])test(`P7 In Too Deep safe-vehicles ${safe} gives only its printed conditional two XP`,()=>{
 const s=board('inTooDeep');s.campaign.records.TheInvestigatorsMadeItSafelyToTheirVehicles=safe;const before=s.campaign.investigators[0].xp
 finish(s,'resolution1');assert.equal(s.campaign.investigators[0].xp,before+(safe?2:0))
})
for(let mask=0;mask<8;mask++)test(`P7 Devil Reef captures actual investigator/act key argument ${mask} before teardown`,()=>{
 const s=board('devilReef'),api=createMechanicsApi(s),here=s.investigators[0].location
 for(const [index,color]of ['purple','white','black'].entries())api.keys.transfer(color,s.scenarioFlags.mechanics.keys[color].holder,mask&(1<<index)?(index===0?`act:${s.acts[0].id}`:'investigator:1'):`location:${here}`,{reveal:true})
 finish(s,'resolution1');assert.deepEqual(s.campaign.flowPayload.recoveredKeys,['purple','white','black'].filter((_,i)=>mask&(1<<i)))
 assert.equal(s.campaign.records.TheTerrorOfDevilReefIsStillAlive,true)
})
for(const selected of ['resolution2','resolution3','resolution4'])test(`P7 Lair XP is awarded before Oceiros choice ${selected}; pending JSON does not duplicate it`,()=>{
 const s=board('theLairOfDagon');s.victoryDisplay.push({id:'actualVictory',code:'07076',originalCode:'07076',victory:2});const before=s.campaign.investigators[0].xp
 const execute=d=>{try{scenarioRuntime(d,[]).finish('resolution1')}catch(e){if(e.constructor.name!=='ScenarioEnded')throw e}}
 resolveTransaction(s,0,{action:'testTicResolution'},execute);assert.equal(s.pendingChoice.source,'oceiros');assert.equal(s.campaign.investigators[0].xp,before+2)
 const saved=JSON.parse(JSON.stringify(s));for(const state of [s,saved]){const c=state.pendingChoice;resolveTransaction(state,c.seat,{action:'choose',choiceId:c.id,optionId:selected},execute)}
 assert.equal(saved.campaign.investigators[0].xp,before+2);assert.equal(saved.campaign.records.TheGatekeeperHasBeenDefeated,true)
 assert.equal(saved.campaign.scenarioResults[0].story.sections.at(-1).title,selected);assert.equal(saved.campaign.pendingNode,'interlude4')
})
for(const [completed,bonus,loss,chain]of [[['07316'],0,false,['resolution1','resolution2']],[['07317'],0,true,['resolution1','resolution3','resolution6']],[['07318'],0,true,['resolution1','resolution3','resolution7']],[['07316','07317'],3,false,['resolution1','resolution2','resolution4']],[['07316','07318'],3,false,['resolution1','resolution2','resolution5']]])test(`P7 final completed acts ${completed.join('+')} follow the actual resolution chain and trauma`,()=>{
 const s=board('intoTheMaelstrom');s.victoryDisplay=completed.map(code=>({id:'act'+code,code,originalCode:code,victory:2}));const before=s.campaign.investigators[0].xp
 finish(s,'resolution1');assert.equal(s.campaign.investigators[0].xp,before+completed.length*2+bonus);assert.equal(s.campaign.trauma[0].physical,2);assert.equal(s.campaign.trauma[0].mental,loss?2:0)
 assert.equal(!!s.campaign.failed,loss);assert.deepEqual(s.campaign.scenarioResults[0].story.sections.map(section=>section.title),chain)
})
test('P7 final noResolution kills the entire campaign roster without awarding XP or R1 trauma',()=>{
 const s=board('intoTheMaelstrom');const before=s.campaign.investigators[0].xp;finish(s,'noResolution')
 assert.ok(s.campaign.records.TheDeepOnesHaveFloodedTheEarth);assert.ok(Object.values(s.campaign.investigators).every(inv=>inv.status==='killed'));assert.equal(s.campaign.investigators[0].xp,before);assert.equal(s.campaign.trauma[0].physical,0)
})
