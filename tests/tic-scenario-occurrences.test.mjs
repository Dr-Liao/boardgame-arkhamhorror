import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { scenarioRuntime, engageEnemy, disengageEnemy } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
registerCardAbilities([
 {code:'testTicOccurrenceEnemy',scope:'enemy',abilities:[{kind:'forced',trigger:'enemyEngaged',limit:{scope:'perWindow',owner:'instance'},resolve:({api,context})=>api.gainResources(context.seat,1)}]},
 {code:'testTicOccurrenceFlood',scope:'location',abilities:[{kind:'forced',trigger:'floodChanged',limit:{scope:'perWindow',owner:'instance'},criteria:({source,context})=>context.location===source.id&&context.delta>0,resolve:({api})=>api.gainResources(0,1)}]},
])
test('P7 two actual engagements in one action are distinct occurrences, including same seat',()=>{
 const s=fixture('01001',2);s.scenario.eventWindowInstances=true
 const e=enemy(s,{code:'testTicOccurrenceEnemy',engagedSeat:null});const before=s.investigators[0].resources
 resolveTransaction(s,0,{action:'testOccurrences'},d=>{const e=d.enemies[0];engageEnemy(d,e,0,[]);disengageEnemy(d,e);engageEnemy(d,e,0,[])})
 assert.equal(s.investigators[0].resources,before+2)
 const saved=JSON.parse(JSON.stringify(s));const serial=saved.instanceSeq.w
 disengageEnemy(saved,saved.enemies[0]);engageEnemy(saved,saved.enemies[0],0,[])
 assert.equal(saved.investigators[0].resources,before+3);assert.equal(saved.instanceSeq.w,serial+1)
})
test('P7 repeated flood increases after draining in one action each trigger once',()=>{
 const s=fixture();s.scenario.eventWindowInstances=true;const here=s.investigators[0].location
 Object.assign(s.locations.find(l=>l.id===here),{code:'testTicOccurrenceFlood',originalCode:'testTicOccurrenceFlood',revealed:true})
 const before=s.investigators[0].resources
 resolveTransaction(s,0,{action:'testOccurrences'},d=>{const api=scenarioRuntime(d,[]).mechanics.water;api.set(here,1);api.set(here,0);api.set(here,1);api.set(here,1)})
 assert.equal(s.investigators[0].resources,before+2);assert.equal(s.instanceSeq.w,3)
})
