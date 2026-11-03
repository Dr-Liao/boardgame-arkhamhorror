// Main review/execution only. These are real engine transactions with synthetic
// adventure fixtures for the proposed primitive, not completed production cards.
import './tic-chapter-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture as coreFixture,move,settle,asset,enemy} from './core-fixture.mjs'
import {registerCardAbilities} from '../src/engine/ability.js'
import {registerCampaignScenarios,scenarioRuntime,drawEncounter,legalMoves,validateMove} from '../src/engine/engine.js'
import {createMechanicsApi} from '../src/engine/api-mechanics.js'
import {validateMechanicState} from '../src/engine/mechanic-state.js'
import {resolveTransaction,choiceError} from '../src/engine/resolution.js'
import {contentRegistry,registerContentBundle} from '../content/registered.js'
import {ALL_CARDS} from '../src/cards/cards-data.js'
// Parent integrates this factory into encounter-entries/_shared.js first.
import {defeatedSuspectAgendaAbility} from '../src/cards/encounter-entries/_shared.js'

const id='testEarlyEnemyZones'
const campaign=structuredClone(contentRegistry.getCampaign('nightOfTheZealot'))
Object.assign(campaign,{id,scenarioIds:[id],status:'development',unlock:{[id]:[]}});delete campaign.flow
const scenario=structuredClone(contentRegistry.getScenarioData('theGathering'));Object.assign(scenario,{id,campaignId:id})
scenario.enemies={...scenario.enemies,
 testEarlyZoneEnemy:{name:'Zone enemy',fight:1,evade:1,health:5,damage:1,horror:0,traits:['Monster']},
 testEarlyPriest:{name:'Replacement priest',fight:1,evade:1,health:1,damage:0,horror:0,traits:['Cultist']}}
scenario.treacheries={...scenario.treacheries,
 testEarlyZonePulse:{code:'testEarlyZonePulse',name:'From the depths primitive fixture',entryRevelation:true},
 testEarlyZoneBlindsense:{code:'testEarlyZoneBlindsense',name:'Blindsense primitive fixture',entryRevelation:true}}
const manifest=structuredClone(contentRegistry.getScenario('theGathering'))
Object.assign(manifest,{id,campaignId:id,status:'development',behaviorIds:[id]})
registerContentBundle({campaigns:[campaign],scenarios:[{scenario,manifest,behavior:{id,
 resolveChaosToken:()=>({delta:0,onDraw:[],onFail:[]}),
 enemyAttackedSuccessfully(state,inv,enemy,api,result){
  if(enemy.code==='testEarlyPriest')assert.equal(result.defeated,enemy.damageTaken>=enemy.health,
   'chapter success hook receives the real accepted-defeat decision after would replacement')
 },
 }}]});registerCampaignScenarios(id)

registerCardAbilities([
 {code:'testEarlyZoneEnemy',scope:'enemy',abilities:[{kind:'forced',trigger:'enemyDefeated',
  criteria:({source,context})=>source.id===context.enemy?.id,
  resolve:({source,context,api})=>api.enemyOutcomes.destination(context,
   {kind:'enemyZone',id:'depths',clearTokens:true,ready:true},{sourceId:source.id})}]},
 {code:'testEarlyPriest',scope:'enemy',abilities:[{kind:'forced',trigger:['enemyWouldBeDefeated','enemyWouldBeEvaded'],
  criteria:({source,context})=>source.id===context.enemy?.id&&!(source.doom>0),
  resolve:({context,api})=>api.enemyOutcomes.replace(context,{healAllDamage:true,ready:true,doom:1})}]},
 {code:'testEarlyOutcomeObserver',abilities:[
  {kind:'forced',trigger:'enemyDefeated',resolve:({inv,api})=>api.gainResources(inv.seat,1)},
  {kind:'forced',trigger:'defeatEnemy',resolve:({inv,api})=>api.gainResources(inv.seat,10)},
  {kind:'forced',trigger:'evadeSuccess',resolve:({inv,api})=>api.gainResources(inv.seat,100)},
 ]},
 {code:'testEarlyLocationObserver',abilities:[
  {kind:'forced',trigger:'defeatEnemy',
   criteria:({inv,context})=>context.seat===inv.seat&&context.location==='here',
   resolve:({inv,context,api})=>{assert.equal(context.enemy.location,null);api.gainResources(inv.seat,1)}},
  {kind:'forced',trigger:'defeatAtLocation',
   criteria:({inv,context})=>context.seat===inv.seat&&context.location==='here',
   resolve:({inv,context,api})=>{assert.equal(context.enemy.location,null);api.gainResources(inv.seat,10)}},
 ]},
 {code:'testEarlyForceDepthsObserver',abilities:[{kind:'forced',trigger:'enemyDefeated',
  criteria:({context})=>context.accepted===true,
  resolve:({context,api})=>api.enemyOutcomes.destination(context,
   {kind:'enemyZone',id:'depths',clearTokens:true,ready:true},{sourceId:'testEarlyForceDepthsObserver'})}]},
 {code:'testEarlyZoneSpawnObserver',abilities:[{kind:'forced',trigger:'enemySpawn',
  criteria:({inv,context})=>context.enemy?.code==='testEarlyZoneEnemy'&&context.enemy.location===inv.location,
  resolve:({state,inv,context,api})=>{
   assert.equal(context.enemy.id,state.scenarioFlags.expectedZoneId)
   assert.equal(context.enemy.damageTaken,0);assert.equal(context.enemy.doom,0)
   api.gainResources(inv.seat,1)
  }}]},
 {code:'testEarlyZonePulse',scope:'treachery',encounterResolve(state,inv,card,api){
  const z=api.mechanics.enemyZones,deep=z.list('depths').find(e=>e.code==='testEarlyZoneEnemy')
  if(deep){z.restore('depths',deep.id,{location:inv.location,engageSeat:inv.seat});return false}
  const active=state.enemies.find(e=>e.code==='testEarlyZoneEnemy')
  if(active)z.enter(active,'depths',{clearTokens:true,ready:true,preserveKeys:true})
  return {gainSurge:true}
 }},
 {code:'testEarlyZoneBlindsense',scope:'treachery',encounterResolve(state,inv,card,api){
  api.test(inv.seat,'agility',3,result=>{
   if(result.success)return
   const z=api.mechanics.enemyZones,deep=z.list('depths').find(e=>e.code==='testEarlyZoneEnemy')
   if(!deep)return
   const restored=z.restore('depths',deep.id,{location:inv.location,engageSeat:inv.seat})
   if(restored)api.attack(restored,state.investigators[inv.seat])
  });return false
 }},
 {code:'testEarlyJail',scope:'location',abilities:[{kind:'forced',trigger:'enemyDefeated',
  criteria:({inv,source,context})=>context.accepted===true&&context.sourceSeat===inv.seat&&inv.location===source.id
   &&!Object.hasOwn(ALL_CARDS[context.enemy.originalCode||context.enemy.code]||{},'victory'),
  resolve:({source,context,api})=>api.enemyOutcomes.destination(context,
   {kind:'scenarioDeck',id:'leads',shuffle:true},{sourceId:source.id})}]},
 {code:'testEarlySuspectAgenda',scope:'agenda',abilities:[defeatedSuspectAgendaAbility({
  isKidnapper:(state,enemy)=>enemy.id===state.scenarioFlags.testKidnapperId,
  recordValue:()=> 'RobertFriendly',
 })]},
])

function fixture(count=1){
 const s=coreFixture('01001',count);s.scenario.id=id;s.humanSeats=s.investigators.map(i=>i.seat);s.abilityLimits={}
 s.locations=[{id:'here',code:'plain',name:'here',revealed:true,clues:1,shroud:1,connections:['remote']},
  {id:'remote',code:'plain',name:'remote',revealed:true,clues:0,shroud:0,connections:['here']}]
 for(const inv of s.investigators){inv.location='here';inv.combat=10;inv.agility=10}
 s.encounterDeck=[];s.encounterDiscard=[];return s
}
const runtime=s=>scenarioRuntime(s,[]),zones=s=>runtime(s).mechanics.enemyZones
function run(s,fn,select=()=>null){resolveTransaction(s,0,{action:'earlyZoneDraft'},fn);finish(s,fn,select)}
function finish(s,fn,select=()=>null){for(let n=0;s.pendingChoice;n++){
 assert.ok(n<150,JSON.stringify(s.pendingChoice));const c=s.pendingChoice
 const m={action:'choose',choiceId:c.id,optionId:select(c)??c.options.find(o=>['skip','done','self'].includes(o.id))?.id??c.options[0].id}
 assert.equal(choiceError(s,c.seat,m),null);resolveTransaction(s,c.seat,m,fn)
}}
function spawn(s,code='testEarlyZoneEnemy'){
 run(s,d=>runtime(d).spawn(code,'here'))
 return s.enemies.find(e=>e.code===code)
}
const units=(s,id)=>s.enemies.filter(e=>e.id===id).length+zones(s).list('depths').filter(e=>e.id===id).length+s.victoryDisplay.filter(e=>e.id===id).length

test('depths effect entry preserves one physical id and keys, clears counters, validates and restores through real spawn once after JSON',()=>{
 const s=fixture(2),e=spawn(s);Object.assign(e,{damageTaken:4,doom:2,clues:3,resources:2,tokens:{resource:2},markers:['resource'],exhausted:true,defeatedBy:0})
 createMechanicsApi(s).keys.initialize([{color:'red',revealed:true,holder:`enemy:${e.id}`}])
 s.chaosBag=['0','bless'];createMechanicsApi(s).chaosTokens.seal(e.id,'bless',1)
 run(s,d=>zones(d).enter(e.id,'depths',{clearTokens:true,ready:true,preserveKeys:true}))
 const deep=zones(s).get('depths',e.id);assert.ok(deep);assert.equal(s.enemies.length,0);assert.equal(units(s,e.id),1)
 assert.deepEqual([deep.damageTaken,deep.doom,deep.clues,deep.resources],[0,0,0,0]);assert.deepEqual(deep.tokens,{})
 assert.deepEqual(deep.markers,[]);assert.equal(deep.damage,1);assert.equal(deep.health,5);assert.equal(deep.horror,0)
 assert.equal(s.chaos.sealed.some(token=>token.source===e.id),false);assert.equal(s.chaosBag.filter(token=>token==='bless').length,1)
 assert.equal(deep.exhausted,false);assert.equal(deep.defeatedBy,undefined)
 assert.deepEqual(createMechanicsApi(s).keys.at(`enemy:${e.id}`),['red']);assert.doesNotThrow(()=>validateMechanicState(s))
 const saved=JSON.parse(JSON.stringify(s));saved.investigators[1].location='remote';saved.scenarioFlags.expectedZoneId=e.id;asset(saved,'testEarlyZoneSpawnObserver',{},1)
 const resources=saved.investigators[1].resources,seq=saved.instanceSeq.e
 run(saved,d=>zones(d).restore('depths',e.id,{location:'remote',engageSeat:1}))
 const restored=saved.enemies.find(x=>x.id===e.id);assert.ok(restored);assert.equal(restored.engagedSeat,1)
 assert.equal(saved.investigators[1].resources,resources+1);assert.equal(saved.instanceSeq.e,seq);assert.equal(units(saved,e.id),1)
 assert.equal(zones(saved).list('depths').length,0);assert.doesNotThrow(()=>validateMechanicState(saved))
})
test('depths invalid and repeated restore leave the exact serialized physical state unchanged',()=>{
 const s=fixture(),e=spawn(s);run(s,d=>zones(d).enter(e.id,'depths'))
 const before=JSON.stringify(s);assert.equal(zones(s).restore('depths',e.id,{location:'missing',engageSeat:0}),null);assert.equal(JSON.stringify(s),before)
 run(s,d=>zones(d).restore('depths',e.id,{location:'here',engageSeat:0}))
 const after=JSON.stringify(s);assert.equal(zones(s).restore('depths',e.id,{location:'here',engageSeat:0}),null);assert.equal(JSON.stringify(s),after);assert.equal(units(s,e.id),1)
})
test('accepted defeat redirected to depths still runs when/after defeat once and transfers defeated enemy keys first',()=>{
 const s=fixture(),e=spawn(s);asset(s,'testEarlyOutcomeObserver');const resources=s.investigators[0].resources
 createMechanicsApi(s).keys.initialize([{color:'red',revealed:true,holder:`enemy:${e.id}`}])
 move(s,{action:'engage',enemyId:e.id});settle(s);run(s,d=>runtime(d).damageEnemy(e.id,5,0))
 assert.equal(s.enemies.length,0);assert.equal(zones(s).list('depths').length,1);assert.equal(units(s,e.id),1)
 assert.equal(s.encounterDiscard.includes('testEarlyZoneEnemy'),false);assert.equal(s.victoryDisplay.some(v=>v.id===e.id),false)
 assert.equal(s.investigators[0].resources,resources+11)
 assert.deepEqual(createMechanicsApi(s).keys.at('investigator:0'),['red']);assert.deepEqual(createMechanicsApi(s).keys.at(`enemy:${e.id}`),[])
})
test('07055 semantics use actual encounter draw: active->depths preserves keys and truly surges; next draw restores same id without surge',()=>{
 const s=fixture(),e=spawn(s);createMechanicsApi(s).keys.initialize([{color:'red',revealed:true,holder:`enemy:${e.id}`}])
 s.encounterDeck=['dissonantVoices','testEarlyZonePulse'];run(s,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(s.enemies.length,0);assert.equal(zones(s).get('depths',e.id).id,e.id)
 assert.equal(s.investigators[0].threat.filter(t=>t.code==='dissonantVoices').length,1)
 assert.deepEqual(createMechanicsApi(s).keys.at(`enemy:${e.id}`),['red'])
 const saved=JSON.parse(JSON.stringify(s));saved.encounterDeck=['dissonantVoices','testEarlyZonePulse']
 run(saved,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(saved.enemies[0].id,e.id);assert.equal(saved.enemies[0].engagedSeat,0);assert.equal(saved.encounterDeck.length,1)
 assert.equal(saved.investigators[0].damage,0);assert.equal(units(saved,e.id),1)
})
test('07054 failed actual agility draw restores existing depths enemy then performs one real effect attack',()=>{
 const s=fixture(),e=spawn(s);run(s,d=>zones(d).enter(e.id,'depths'));s.chaosBag=['autofail'];s.encounterDeck=['testEarlyZoneBlindsense']
 run(s,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(s.lastTestResult.skill,'agility');assert.equal(s.lastTestResult.success,false)
 assert.equal(s.enemies[0].id,e.id);assert.equal(s.enemies[0].engagedSeat,0);assert.equal(s.investigators[0].damage,1)
 assert.equal(s.encounterDiscard.filter(code=>code==='testEarlyZoneBlindsense').length,1);assert.equal(units(s,e.id),1)
})
test('depths enemies cannot be fought or damaged through stale references and do not resolve queued attacks',()=>{
 const s=fixture(),e=spawn(s);run(s,d=>zones(d).enter(e.id,'depths'));const before=JSON.stringify(s)
 assert.equal(legalMoves(s).some(m=>m.enemyId===e.id),false)
 assert.notEqual(validateMove(s,0,{action:'fight',enemyId:e.id}),null)
 run(s,d=>{const dead=zones(d).get('depths',e.id);runtime(d).damageEnemy(dead.id,5,0);runtime(d).attack(dead,d.investigators[0])})
 assert.equal(zones(s).get('depths',e.id).damageTaken,0);assert.equal(s.investigators[0].damage,0)
 assert.equal(s.enemies.length,0);assert.equal(units(s,e.id),1)
 // Transaction bookkeeping may change; physical state and combat counters may not.
 assert.ok(before.includes(e.id))
})
test('Priest would-defeat replacement occurs before normal keys/history/when/after cleanup; next doom1 defeat is ordinary',()=>{
 const s=fixture(),e=spawn(s,'testEarlyPriest');asset(s,'testEarlyOutcomeObserver');const resources=s.investigators[0].resources
 createMechanicsApi(s).keys.initialize([{color:'red',revealed:true,holder:`enemy:${e.id}`}])
 move(s,{action:'engage',enemyId:e.id});settle(s);move(s,{action:'fight',enemyId:e.id});settle(s)
 const live=s.enemies.find(x=>x.id===e.id)
 assert.equal(live.id,e.id);assert.equal(live.damageTaken,0);assert.equal(live.doom,1);assert.equal(live.exhausted,false);assert.equal(live.engagedSeat,0)
 assert.equal(s.investigators[0].resources,resources);assert.deepEqual(createMechanicsApi(s).keys.at(`enemy:${e.id}`),['red'])
 assert.equal(s.encounterDiscard.includes('testEarlyPriest'),false);assert.equal(s.locations[0].enemyDefeatedRound,undefined)
 move(s,{action:'fight',enemyId:e.id});settle(s)
 assert.equal(s.enemies.some(x=>x.id===e.id),false);assert.equal(s.investigators[0].resources,resources+11)
 assert.deepEqual(createMechanicsApi(s).keys.at('investigator:0'),['red'])
})
test('Priest would-evade replacement keeps successful test but emits no ordinary after-evade outcome',()=>{
 const s=fixture(),e=spawn(s,'testEarlyPriest');asset(s,'testEarlyOutcomeObserver');const resources=s.investigators[0].resources
 move(s,{action:'engage',enemyId:e.id});settle(s)
 move(s,{action:'evade',enemyId:e.id});settle(s)
 let live=s.enemies.find(x=>x.id===e.id)
 assert.equal(s.lastTestResult.success,true);assert.equal(live.exhausted,false);assert.equal(live.engagedSeat,0);assert.equal(live.doom,1)
 assert.equal(s.investigators[0].resources,resources)
 move(s,{action:'evade',enemyId:e.id});settle(s)
 live=s.enemies.find(x=>x.id===e.id)
 assert.equal(live.exhausted,true);assert.equal(live.engagedSeat,null);assert.equal(s.investigators[0].resources,resources+100)
})
test('Jail actorHere redirects remote non-Victory defeat to true Leads, retaining ordinary defeat afters',()=>{
 const s=fixture();Object.assign(s.locations[0],{code:'testEarlyJail',originalCode:'testEarlyJail'});createMechanicsApi(s).scenarioDecks.initialize('leads',[],{shuffle:false})
 asset(s,'testEarlyOutcomeObserver');const resources=s.investigators[0].resources
 const e=enemy(s,{code:'ghoulMinion',originalCode:'01160',location:'remote',engagedSeat:null,health:1})
 run(s,d=>runtime(d).damageEnemy(e.id,1,0))
 assert.deepEqual(createMechanicsApi(s).scenarioDecks.cards('leads'),['ghoulMinion']);assert.equal(s.encounterDiscard.includes('ghoulMinion'),false)
 assert.equal(s.investigators[0].resources,resources+11);assert.equal(s.enemies.some(x=>x.id===e.id),false)
 run(s,d=>runtime(d).mechanics.scenarioDecks.revealChooseDraw('leads',0,1))
 assert.equal(createMechanicsApi(s).scenarioDecks.size('leads'),0)
 assert.equal(s.enemies.filter(x=>x.code==='ghoulMinion').length,1,'returned physical card must be drawable through its bound encounter code')
})
test('Jail excludes printed Victory0 and an actor outside Jail, not just positive Victory scores',()=>{
 for(const reason of ['victory0','outside']){
  const s=fixture();Object.assign(s.locations[0],{code:'testEarlyJail',originalCode:'testEarlyJail'});createMechanicsApi(s).scenarioDecks.initialize('leads',[],{shuffle:false})
  if(reason==='outside')s.investigators[0].location='remote'
  const e=enemy(s,{code:reason==='victory0'?'07076':'ghoulMinion',originalCode:reason==='victory0'?'07076':'01160',location:'here',engagedSeat:null,health:1,victory:0})
  run(s,d=>runtime(d).damageEnemy(e.id,1,0))
  assert.deepEqual(createMechanicsApi(s).scenarioDecks.cards('leads'),[])
  if(reason==='victory0')assert.equal(s.victoryDisplay.filter(v=>v.id===e.id).length,1)
  else assert.equal(s.encounterDiscard.includes('ghoulMinion'),true)
 }
})
function suspectBoard(kind='ordinary'){
 const s=fixture();s.agendas=[{id:'suspectAgenda',code:'testEarlySuspectAgenda',stage:1,name:'Agenda',doomThreshold:99},{id:'plainAgenda',code:'plain',stage:2,name:'Inactive',doomThreshold:99}];s.agendaIndex=kind==='inactive'?1:0
 const e=enemy(s,{code:'07076',originalCode:'07076',health:1,engagedSeat:0,traits:['Suspect'],clues:2,victory:0})
 if(kind==='kidnapper')s.scenarioFlags.testKidnapperId=e.id
 return {s,e}
}
test('active Suspect agenda takes clues from retired enemy context and records canonical enum on true investigator defeat',()=>{
 const {s,e}=suspectBoard();run(s,d=>runtime(d).damageEnemy(e.id,1,0))
 assert.equal(s.investigators[0].clues,2);assert.deepEqual(s.campaign.records.outForBlood,['RobertFriendly'])
 assert.equal(s.victoryDisplay.filter(v=>v.id===e.id).length,1)
 const saved=JSON.parse(JSON.stringify(s));assert.deepEqual(saved.campaign.records.outForBlood,['RobertFriendly'])
})
test('Suspect agenda excludes kidnapper, inactive agenda and environmental defeat despite engagedSeat0',()=>{
 for(const kind of ['kidnapper','inactive','environment']){
  const {s,e}=suspectBoard(kind);run(s,d=>runtime(d).damageEnemy(e.id,1,kind==='environment'?null:0))
  assert.equal(s.investigators[0].clues,0);assert.deepEqual(s.campaign.records.outForBlood||[],[])
 }
})
test('parley last-clue Victory0 bypasses all defeat windows and never records OutForBlood',()=>{
 const {s,e}=suspectBoard();asset(s,'testEarlyOutcomeObserver');const resources=s.investigators[0].resources
 run(s,d=>runtime(d).takeEnemyClues(d.enemies.find(x=>x.id===e.id),0,2,{victoryWhenEmpty:true}))
 assert.equal(s.investigators[0].clues,2);assert.deepEqual(s.campaign.records.outForBlood||[],[])
 assert.equal(s.investigators[0].resources,resources);assert.equal(s.victoryDisplay.filter(v=>v.id===e.id).length,1)
})

test('accepted depths defeat after windows use captured physical location after stored enemy location is null',()=>{
 const s=fixture(2),e=spawn(s)
 for(const inv of s.investigators)asset(s,'testEarlyLocationObserver',{},inv.seat)
 const before=s.investigators.map(inv=>inv.resources)
 run(s,d=>runtime(d).damageEnemy(e.id,5,0))
 assert.equal(zones(s).get('depths',e.id).location,null)
 assert.equal(s.investigators[0].resources,before[0]+1,'actual defeater receives its own after-defeat window')
 assert.equal(s.investigators[1].resources,before[1]+10,'other local investigator receives defeatAtLocation at the captured location')
})

test('instead-of-discarding destination never replaces default printed Victory0, positive Victory or vengeance placement',()=>{
 for(const kind of ['printedVictory0','positiveVictory','vengeance']){
  const s=fixture();asset(s,'testEarlyForceDepthsObserver')
  const e=kind==='printedVictory0'
   ?enemy(s,{code:'07076',originalCode:'07076',health:1,victory:0,traits:['Suspect']})
   :spawn(s)
  if(kind==='positiveVictory')e.victory=2
  if(kind==='vengeance')e.vengeance=1
  run(s,d=>runtime(d).damageEnemy(e.id,100,0))
  assert.equal(zones(s).list('depths').length,0,kind)
  assert.equal(s.victoryDisplay.filter(card=>card.id===e.id).length,1,kind)
  assert.equal(s.encounterDiscard.includes(e.code),false,kind)
 }
})

test('automatic evade uses the same Priest would-evade boundary and preserves the true actor',()=>{
 const s=fixture(2),e=spawn(s,'testEarlyPriest');e.damageTaken=1
 move(s,{action:'engage',enemyId:e.id});settle(s)
 run(s,d=>runtime(d).evadeEnemy(d.enemies.find(enemy=>enemy.id===e.id),{seat:0,source:'automaticEvadeFixture'}))
 let live=s.enemies.find(enemy=>enemy.id===e.id)
 assert.equal(live.engagedSeat,0);assert.equal(live.exhausted,false);assert.equal(live.damageTaken,0);assert.equal(live.doom,1)
 assert.equal(s.investigators[0].engaged.includes(e.id),true)
 run(s,d=>runtime(d).evadeEnemy(d.enemies.find(enemy=>enemy.id===e.id),{seat:0,source:'automaticEvadeFixture'}))
 live=s.enemies.find(enemy=>enemy.id===e.id)
 assert.equal(live.engagedSeat,null);assert.equal(live.exhausted,true)
})

test('real fight return distinguishes a Priest replacement from the next accepted defeat',()=>{
 const s=fixture(),e=spawn(s,'testEarlyPriest');let result
 move(s,{action:'engage',enemyId:e.id});settle(s)
 run(s,d=>{result=runtime(d).fight(0,e.id)})
 assert.equal(result.success,true)
 assert.equal(result.attackResult.defeated,false,'successful attack test alone does not mean an actual defeat occurred')
 assert.equal(s.enemies.some(enemy=>enemy.id===e.id),true)
 run(s,d=>{result=runtime(d).fight(0,e.id)})
 assert.equal(result.success,true);assert.equal(result.attackResult.defeated,true)
 assert.equal(s.enemies.some(enemy=>enemy.id===e.id),false)
})
