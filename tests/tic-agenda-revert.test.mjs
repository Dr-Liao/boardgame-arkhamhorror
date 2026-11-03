import test from 'node:test'
import assert from 'node:assert/strict'
import {chapterFixture} from './tic-chapter-fixture.mjs'
import {scenarioRuntime} from '../src/engine/engine.js'
import {registerCardAbilities} from '../src/engine/ability.js'
import {resolveTransaction} from '../src/engine/resolution.js'
import {createMechanicsApi} from '../src/engine/api-mechanics.js'
registerCardAbilities([{code:'testTicRevertAgenda',scope:'agenda',agendaRule:{onReveal:(state,agenda,api)=>{api.setScenarioFlag('revertCalls',(state.scenarioFlags.revertCalls||0)+1);assert.equal(api.revertAgenda(),true)}}}])
function run(s){const execute=d=>scenarioRuntime(d,[]).advanceAgenda();resolveTransaction(s,0,{action:'testRevert'},execute);for(let n=0;s.pendingChoice;n++){assert.ok(n<20);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:c.options[0].id},execute)}}
test('P7 agenda reversion retains its physical card and attachments after ordinary doom clearing, including repeated JSON continuation',()=>{
 const s=chapterFixture('aLightInTheFog'),index=s.agendaIndex,agenda=s.agendas[index];agenda.code=agenda.originalCode='testTicRevertAgenda'
 agenda.attachments=[{id:'physicalAgendaNote',code:'01090',ownerSeat:0,doom:2}];s.doom=5
 const api=createMechanicsApi(s);api.chaosTokens.add('bless',1);api.chaosTokens.seal('physicalAgendaNote','bless',1)
 assert.equal(scenarioRuntime(s,[]).revertAgenda(),false)
 run(s)
 assert.equal(s.agendaIndex,index);assert.equal(s.agendas[index].id,agenda.id);assert.equal(s.agendaFace,'front');assert.equal(s.doom,0)
 assert.equal(s.agendas[index].attachments[0].doom,0);assert.equal(s.chaos.sealed.some(t=>t.source==='physicalAgendaNote'),true);assert.equal(s.scenarioFlags.revertCalls,1)
 const saved=JSON.parse(JSON.stringify(s));saved.doom=5;run(saved)
 assert.equal(saved.agendaIndex,index);assert.equal(saved.agendas[index].id,agenda.id);assert.equal(saved.scenarioFlags.revertCalls,2);assert.equal(saved.doom,0)
 assert.equal(saved.agendas[index].attachments.length,1);assert.equal(saved.investigators[0].discard.includes('01090'),false)
})
