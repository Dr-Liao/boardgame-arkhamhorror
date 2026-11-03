import test from 'node:test'
import assert from 'node:assert/strict'
import {hunterRouteCandidates} from '../src/engine/enemy-routes.js'
import {fixture,enemy,asset} from './core-fixture.mjs'
import {scenarioRuntime,hunterStep,resolveHunterMove} from '../src/engine/engine.js'
import {createMechanicsApi} from '../src/engine/api-mechanics.js'
import {registerCardAbilities} from '../src/engine/ability.js'
registerCardAbilities([{code:'testTicIgnoreBarriers',scope:'enemy',enemyRule:{ignoreHunterBarriers:true}},{code:'testTicMoves',abilities:[{kind:'forced',trigger:'enemyMoved',resolve:({state,api})=>api.setScenarioFlag('moves',(state.scenarioFlags.moves||0)+1)}]}])
function board(){const s=fixture('01001');s.scenario.eventWindowInstances=true;s.phaseInstance=1;s.phase='enemy';s.locations=['a','b','c','d'].map(id=>({id,name:id,revealed:true,traits:[],connections:{a:['b','c'],b:['a','d'],c:['a','d'],d:['b','c']}[id],clues:0}));s.investigators[0].location='d';asset(s,'testTicMoves');return s}
test('P7 real Hunter takes a complete barrier-free detour, then falls back only if no such route exists',()=>{
 const s=board(),e=enemy(s,{location:'a',hunter:true,engagedSeat:null,exhausted:false}),api=createMechanicsApi(s)
 api.barriers.set('b','d',1);api.barriers.set('a','c',1)
 const fallback=hunterRouteCandidates(s,e,['d'],{connections:id=>s.locations.find(l=>l.id===id).connections,canEnter:()=>true})
 assert.equal(fallback.ignoresBarriers,true);assert.deepEqual(fallback.destinations.sort(),['b','c'])
 // The apparent short first step b has a later barrier; its longer b-a-c-d
 // route repeats the origin and must not be considered an open route.
 api.barriers.set('a','c',0)
 assert.equal(hunterStep(s,e,{barrierRouting:true}),'c')
 const r=resolveHunterMove(s,e,[])
 assert.equal(r.moved,true);assert.equal(e.location,'c');assert.equal(s.scenarioFlags.moves,1)
 assert.deepEqual(e.lastHunterMove,{round:s.round,phase:'enemy',phaseInstance:1,from:'a',to:'c'})
 const saved=JSON.parse(JSON.stringify(s));assert.equal(saved.enemies[0].lastHunterMove.to,'c')
})
test('P7 effect one-step movement ignores barriers and can ignore Aloof for that entry only',()=>{
 const s=board(),e=enemy(s,{location:'b',hunter:false,aloof:true,printedAloof:true,engagedSeat:null,exhausted:false}),api=createMechanicsApi(s)
 api.barriers.set('b','d',1)
 assert.equal(scenarioRuntime(s,[]).moveEnemyToward(e,'d',{ignoreAloof:true}).moved,true)
 assert.equal(e.location,'d');assert.equal(e.engagedSeat,0);assert.equal(e.aloof,true)
 assert.equal(s.scenarioFlags.moves,1)
 assert.equal(scenarioRuntime(s,[]).moveEnemyToward(e,'d',{ignoreAloof:true}).moved,false)
 assert.equal(s.scenarioFlags.moves,1)
})
test('P7 true Hunter movement excludes exhausted and already-local targets without a false movement record',()=>{
 const s=board(),e=enemy(s,{location:'d',hunter:true,engagedSeat:null,exhausted:false})
 assert.equal(resolveHunterMove(s,e,[]).moved,false);assert.equal(e.lastHunterMove,undefined)
 e.location='b';e.exhausted=true
 assert.equal(resolveHunterMove(s,e,[]).moved,false);assert.equal(s.scenarioFlags.moves,undefined)
})

test('P7 printed Hunter ignore-barriers uses blocked shortest route rather than an open detour',()=>{
 const s=board(),e=enemy(s,{code:'testTicIgnoreBarriers',hunter:true,engagedSeat:null,location:'a'}),api=createMechanicsApi(s)
 s.locations.push({id:'e',name:'e',connections:['c','d'],revealed:true,traits:[],clues:0})
 s.locations.find(l=>l.id==='c').connections=['a','e'];s.locations.find(l=>l.id==='d').connections=['b','e']
 api.barriers.set('a','b',1)
 assert.equal(hunterStep(s,e,{barrierRouting:true}),'b')
 e.textBlanked={round:s.round,phase:s.phase}
 assert.equal(hunterStep(s,e,{barrierRouting:true}),'c')
})

registerCardAbilities([{code:'testTicEngagement',abilities:[{kind:'forced',trigger:'enemyEngaged',resolve:({state,api})=>api.setScenarioFlag('engagedSeats',[...(state.scenarioFlags.engagedSeats||[]),state._resolvingSeat])}]}])
test('P7 forced movement engages the requested actor without an intermediate wrong-seat engagement and preserves exhaustion',()=>{
 const s=board();s.investigators.push({...s.investigators[0],seat:1,assets:[],engaged:[],hand:[],threat:[]});s.numInvestigators=2
 asset(s,'testTicEngagement');const e=enemy(s,{location:'b',engagedSeat:null,exhausted:true}),api=scenarioRuntime(s,[])
 assert.equal(api.engageAtInvestigator(e,1),true);assert.equal(e.location,'d');assert.equal(e.engagedSeat,1);assert.equal(e.exhausted,true)
 assert.deepEqual(s.investigators[0].engaged,[]);assert.deepEqual(s.investigators[1].engaged,[e.id]);assert.equal(s.scenarioFlags.engagedSeats.length,1)
 assert.equal(api.reengageEnemy(e,1),true);assert.equal(s.scenarioFlags.engagedSeats.length,2)
 assert.equal(api.reengageEnemy(e,5),false);assert.equal(s.scenarioFlags.engagedSeats.length,2)
})
