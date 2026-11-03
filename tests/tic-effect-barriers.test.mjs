import test from 'node:test'
import assert from 'node:assert/strict'
import {chapterFixture} from './tic-chapter-fixture.mjs'
import {scenarioRuntime,legalMoves} from '../src/engine/engine.js'
import {createMechanicsApi} from '../src/engine/api-mechanics.js'
import {resolveTransaction} from '../src/engine/resolution.js'
function run(s,execute){resolveTransaction(s,0,{action:'testEffectBarrier'},execute);for(let n=0;s.pendingChoice;n++){assert.ok(n<60);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:(c.options.find(o=>['skip','done'].includes(o.id))||c.options[0]).id},execute)}}
test('P7 explicit effect move ignores only barriers and still enforces other physical movement restrictions',()=>{
 const s=chapterFixture('inTooDeep'),api=createMechanicsApi(s),inv=s.investigators[0],here=s.locations.find(l=>l.id===inv.location)
 const next=here.connections[0];assert.ok(next);api.barriers.set(here.id,next,1);s.locations.find(l=>l.id===next).revealed=true
 assert.equal(legalMoves(s).some(m=>m.action==='move'&&m.locationId===next),false)
 run(s,d=>scenarioRuntime(d,[]).moveInvestigator(0,next));assert.equal(s.investigators[0].location,here.id)
 run(s,d=>scenarioRuntime(d,[]).moveInvestigator(0,next,{ignoreBarriers:true}));assert.equal(s.investigators[0].location,next)
 const saved=JSON.parse(JSON.stringify(s));saved.locations.find(l=>l.id===next).cannotLeaveRound=saved.round
 run(saved,d=>scenarioRuntime(d,[]).moveInvestigator(0,here.id,{ignoreBarriers:true}));assert.equal(saved.investigators[0].location,next)
})
