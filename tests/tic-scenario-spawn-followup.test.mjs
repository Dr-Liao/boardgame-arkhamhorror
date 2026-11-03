import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { registerCampaignScenarios, drawEncounter, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
const id='testTicSpawnPrimitive'
const campaign=structuredClone(contentRegistry.getCampaign('nightOfTheZealot'));Object.assign(campaign,{id,scenarioIds:[id],status:'development',unlock:{[id]:[]}});delete campaign.flow
const scenario=structuredClone(contentRegistry.getScenarioData('theGathering'));Object.assign(scenario,{id,campaignId:id})
const manifest=structuredClone(contentRegistry.getScenario('theGathering'));Object.assign(manifest,{id,campaignId:id,status:'development',behaviorIds:[id]})
scenario.enemies={...scenario.enemies,testTicHomeEnemy:{originalCode:'07076',name:'Home',fight:1,evade:1,health:5,damage:0,horror:0,victory:0},testTicFarthestEnemy:{name:'Farthest',fight:1,evade:1,health:5,damage:0,horror:0}}
registerContentBundle({campaigns:[campaign],scenarios:[{scenario,manifest,behavior:{id}}]});registerCampaignScenarios(id)
registerCardAbilities([{code:'testTicHomeEnemy',scope:'enemy',enemyRule:{revelationSpawn:{locationOriginalCodes:['testTicHomeA','testTicHomeB'],cluesPerInvestigator:1}}},{code:'testTicFarthestEnemy',scope:'enemy',enemyRule:{revelationSpawn:{farthestOfCodes:['testTicLair','testTicGateway']}}}])
function board(count=2){const s=fixture('01001',count);s.scenario.id=id;s.humanSeats=s.investigators.map(i=>i.seat);return s}
function run(s,execute,select=()=>null){resolveTransaction(s,0,{action:'testSpawnPrimitive'},execute);for(let guard=0;s.pendingChoice;guard++){assert.ok(guard<50);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:select(c)??c.options.find(o=>['skip','done','self'].includes(o.id))?.id??c.options[0].id},execute)}}
test('P7 home revelation adds scaled clues only on actual draw; parley transfers and banishes printed victory zero',()=>{
 const s=board(),here=s.investigators[0].location
 s.locations.push({id:'homePhysical',code:'testTicHomeA',originalCode:'testTicHomeA',name:'Home',revealed:true,connections:[here]})
 s.encounterDeck=['testTicHomeEnemy'];s.encounterDiscard=[]
 run(s,d=>drawEncounter(d,d.investigators[1],[]))
 const e=s.enemies.find(e=>e.code==='testTicHomeEnemy');assert.equal(e.location,'homePhysical');assert.equal(e.clues,2);assert.equal(e.engagedSeat,null)
 const api=scenarioRuntime(s,[]);assert.equal(api.takeEnemyClues(e,1,1,{victoryWhenEmpty:true}),1);assert.equal(e.clues,1);assert.ok(s.enemies.includes(e))
 assert.equal(api.takeEnemyClues(e,1,1,{victoryWhenEmpty:true}),1);assert.ok(!s.enemies.includes(e));assert.equal(s.investigators[1].clues,2)
 assert.equal(s.victoryDisplay.filter(v=>v.originalCode==='07076').length,1)
 const direct=api.spawn('testTicHomeEnemy','homePhysical');assert.equal(direct.clues,undefined)
})
test('P7 farthest spawn chooses ties by actual drawer and preserves pending JSON choice',()=>{
 const s=board(),here=s.investigators[1].location
 s.locations.find(l=>l.id===here).connections=['lairPhysical','gatePhysical']
 s.locations.push({id:'lairPhysical',code:'testTicLair',name:'Lair',revealed:true,connections:[here]},{id:'gatePhysical',code:'testTicGateway',name:'Gateway',revealed:true,connections:[here]})
 s.encounterDeck=['testTicFarthestEnemy'];s.encounterDiscard=[]
 const execute=d=>drawEncounter(d,d.investigators[1],[])
 resolveTransaction(s,1,{action:'testSpawnPrimitive'},execute);assert.equal(s.pendingChoice.seat,1)
 const saved=JSON.parse(JSON.stringify(s))
 for(const state of [s,saved]){const c=state.pendingChoice;resolveTransaction(state,1,{action:'choose',choiceId:c.id,optionId:'gatePhysical'},execute)}
 assert.equal(s.enemies[0].location,'gatePhysical');assert.equal(saved.enemies[0].location,'gatePhysical')
})
test('P7 scenario deck discard moves exact physical top cards directly into encounter discard',()=>{
 const s=board(),api=createMechanicsApi(s);s.encounterDiscard=[]
 api.scenarioDecks.initialize('leads',['a','b','c'],{shuffle:false})
 assert.deepEqual(api.scenarioDecks.discardTop('leads',2),['c','b']);assert.deepEqual(s.encounterDiscard,['c','b']);assert.deepEqual(api.scenarioDecks.cards('leads'),['a'])
 assert.deepEqual(api.scenarioDecks.discardTop('leads',3),['a']);assert.deepEqual(api.scenarioDecks.discardTop('leads',1),[])
})
