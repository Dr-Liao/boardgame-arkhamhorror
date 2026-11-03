// Proposed primitive acceptance cases for main to execute; worker runs syntax checks only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,asset,enemy} from '../tests/core-fixture.mjs'
import {createMechanicsApi} from '../src/engine/api-mechanics.js'
import {registerCardAbilities,registeredEntry} from '../src/engine/ability.js'
import {resolveTransaction,choiceError} from '../src/engine/resolution.js'
import {executeDescriptor,legalMoves} from '../src/engine/engine.js'

registerCardAbilities([
 {code:'testEarlyBarrierRemoval',abilities:[{kind:'action',cost:{action:false},resolve:({inv,api})=>api.barriers.removeConnected(inv.seat,inv.location)}]},
 {code:'testEarlyBarrierMove',abilities:[{kind:'action',cost:{action:false},resolve:({inv,api})=>api.barriers.moveConnected(inv.seat,inv.location)}]},
 {code:'testEarlyCannotPlace',scope:'location',locationRule:{cannotPlaceBarriers:true}},
 {code:'testEarlyImmuneDefeat',scope:'enemy',modifiers:[{target:'cannot:beDefeated',amount:1}]},
 {code:'testEarlyDefeatPredicate',abilities:[{kind:'action',cost:{action:false},criteria:({state,inv,source,helpers})=>state.enemies.some(e=>e.location===inv.location&&helpers.canDefeatEnemy(e,inv.seat,source)),
  resolve:({state,inv,source,api})=>{const target=state.enemies.find(e=>e.location===inv.location&&api.canDefeatEnemy(e,inv.seat,source));if(target)api.scenario.defeatEnemy(target,{source,seat:inv.seat})}}]},
])
function board(){const s=fixture();s.humanSeats=[0];const from=s.investigators[0].location;s.locations[0].connections=['left','right'];s.locations.push(
 {id:'left',name:'left',code:'plain',connections:[from],revealed:true},
 {id:'right',name:'right',code:'plain',connections:[from],revealed:true});return s}
function invoke(s,code){const exec=d=>executeDescriptor(d,{inv:d.investigators[0],source:d.investigators[0].assets.find(a=>a.code===code),descriptor:registeredEntry(code).abilities[0],events:[],silent:true});resolveTransaction(s,0,{action:'earlyPrimitiveDraft'},exec);return exec}
function answer(s,exec,id){const c=s.pendingChoice,m={action:'choose',choiceId:c.id,optionId:id};assert.equal(choiceError(s,c.seat,m),null);resolveTransaction(s,c.seat,m,exec)}

test('proposed connected removal: choose one edge, preserve other counts and pending-choice save',()=>{
 const s=board(),from=s.investigators[0].location,a=createMechanicsApi(s);a.barriers.set(from,'left',2);a.barriers.set(from,'right',1);asset(s,'testEarlyBarrierRemoval')
 const exec=invoke(s,'testEarlyBarrierRemoval');assert.ok(s.pendingChoice);const saved=JSON.parse(JSON.stringify(s)),id=s.pendingChoice.options[0].id
 for(const state of [s,saved])answer(state,exec,id)
 const counts=[createMechanicsApi(s).barriers.count(from,'left'),createMechanicsApi(s).barriers.count(from,'right')]
 assert.equal(counts.reduce((n,x)=>n+x,0),2);assert.deepEqual(s.scenarioFlags.mechanics,saved.scenarioFlags.mechanics)
 assert.equal(createMechanicsApi(s).barriers.count('left',from),counts[0])
})
test('proposed connected removal: no edge is a no-op and insufficient count never goes negative',()=>{
 const s=board(),from=s.investigators[0].location,a=createMechanicsApi(s)
 assert.equal(a.barriers.removeConnected(0,from),false)
 a.barriers.set(from,'left',1)
 assert.equal(a.barriers.removeConnected(0,from,2),false)
 assert.equal(a.barriers.count(from,'left'),1)
})
test('proposed barrier transfer: Coastline cannot receive, source remains intact when no legal recipient',()=>{
 const s=board(),from=s.investigators[0].location,a=createMechanicsApi(s);a.barriers.set(from,'left',2)
 s.locations.find(l=>l.id==='right').code='testEarlyCannotPlace'
 assert.equal(a.barriers.moveConnected(0,from),false);assert.equal(a.barriers.count(from,'left'),2)
 s.locations.find(l=>l.id==='right').code='plain'
 assert.equal(a.barriers.moveConnected(0,from),true);assert.equal(a.barriers.count(from,'left'),1);assert.equal(a.barriers.count(from,'right'),1)
})
test('proposed defeat predicate: forbidden target rejected before activation and runtime defeat uses same rule',()=>{
 const s=board(),tool=asset(s,'testEarlyDefeatPredicate');enemy(s,{code:'testEarlyImmuneDefeat',originalCode:'testEarlyImmuneDefeat'})
 assert.equal(legalMoves(s).some(m=>m.assetId===tool.id),false)
 const e=enemy(s,{engagedSeat:null});assert.ok(legalMoves(s).some(m=>m.assetId===tool.id))
 const exec=invoke(s,'testEarlyDefeatPredicate')
 for(let n=0;s.pendingChoice;n++){assert.ok(n<30);const c=s.pendingChoice;answer(s,exec,c.options.find(o=>o.id==='skip')?.id??c.options[0].id)}
 assert.equal(s.enemies.some(x=>x.id===e.id),false)
 assert.equal(s.enemies.some(x=>x.code==='testEarlyImmuneDefeat'),true)
})
