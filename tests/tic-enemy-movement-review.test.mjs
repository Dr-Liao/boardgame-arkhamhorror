// Draft for main review/copy/execution. No worker behavior execution.
// Exercises current actual engine paths, without inventing a Shoggoth reader.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,enemy,asset} from './core-fixture.mjs'
import {enemyPhase,hunterStep,resolveHunterMove} from '../src/engine/engine.js'
import {registerCardAbilities} from '../src/engine/ability.js'
import {createMechanicsApi} from '../src/engine/api-mechanics.js'
import {resolveTransaction} from '../src/engine/resolution.js'

registerCardAbilities([
 {code:'testEarlyReviewLure',locationLure:true},
 {code:'testEarlyReviewHunterObserver',abilities:[{kind:'forced',trigger:'enemyMoved',
  resolve:({context,api})=>api.setScenarioFlag('earlyHunterSeen',{
   cause:context.cause,hunter:context.hunter,from:context.from,to:context.to,
  })}]},
])
function board(){
 const s=fixture();s.scenario.eventWindowInstances=true;s.phaseInstance=1;s.phase='enemy'
 const links={a:['b','c'],b:['a','d'],c:['a','e'],e:['c','d'],d:['b','e']}
 s.locations=Object.entries(links).map(([id,connections])=>({id,name:id,code:'plain',revealed:true,traits:[],clues:0,connections}))
 s.investigators[0].location='d';s.enemies=[];s.humanSeats=[0]
 asset(s,'testEarlyReviewHunterObserver')
 const foe=enemy(s,{location:'a',hunter:true,exhausted:false,engagedSeat:null,damage:0,horror:0})
 return {s,foe}
}
function run(s,execute){
 resolveTransaction(s,0,{action:'earlyMovementReview'},execute)
 for(let n=0;s.pendingChoice;n++){
  assert.ok(n<80,JSON.stringify(s.pendingChoice))
  const c=s.pendingChoice
  const id=c.options.find(o=>['done','skip','self'].includes(o.id))?.id||c.options[0].id
  resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:id},execute)
 }
}
test('actual enemyPhase labels real Hunter movement and records the current phase instance',()=>{
 const {s,foe}=board()
 run(s,d=>enemyPhase(d))
 const live=s.enemies.find(e=>e.id===foe.id)
 assert.equal(live.location,'b')
 assert.deepEqual(s.scenarioFlags.earlyHunterSeen,{cause:'hunter',hunter:true,from:'a',to:'b'})
 assert.deepEqual(live.lastHunterMove,{round:s.round,phase:'enemy',phaseInstance:s.phaseInstance,from:'a',to:'b'})
})
test('actual Hunter relocation cannot overwrite a barrier-aware lure detour with a blocked short route',()=>{
 const {s,foe}=board()
 s.playerLocationAttachments=[{id:'reviewLure',code:'testEarlyReviewLure',ownerSeat:0,location:'d',extra:{round:s.round}}]
 createMechanicsApi(s).barriers.set('a','b',1)
 assert.equal(hunterStep(s,foe,{barrierRouting:true}),'c')
 run(s,d=>resolveHunterMove(d,d.enemies.find(e=>e.id===foe.id),[]))
 assert.equal(s.enemies.find(e=>e.id===foe.id).location,'c')
 assert.equal(createMechanicsApi(s).barriers.count('a','b'),1)
 assert.deepEqual(s.scenarioFlags.earlyHunterSeen,{cause:'hunter',hunter:true,from:'a',to:'c'})
})
