import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
registerCardAbilities([{code:'testTicCombinedHarmObserver',abilities:[{kind:'forced',trigger:'harmDealt',limit:{scope:'perWindow',owner:'instance'},resolve:({state,context,api})=>api.scenario.setScenarioFlag('combinedHarmPackets',[...(state.scenarioFlags.combinedHarmPackets||[]),{damage:context.damage,horror:context.horror}])}]}])
test('P7 scenario combined damage and horror share one real harm packet and one assignment window',()=>{
 const s=fixture();asset(s,'testTicCombinedHarmObserver');s.humanSeats=[0]
 const execute=d=>scenarioRuntime(d,[]).harm(0,{damage:1,horror:1})
 resolveTransaction(s,0,{action:'testTicCombinedHarm'},execute)
 const pending=s.pendingChoice?JSON.parse(JSON.stringify(s)):null
 const finish=state=>{for(let guard=0;state.pendingChoice;guard++){assert.ok(guard<30);const c=state.pendingChoice;resolveTransaction(state,c.seat,{action:'choose',choiceId:c.id,optionId:c.options.find(o=>o.id==='self')?.id??c.options[0].id},execute)}}
 finish(s);if(pending){finish(pending);assert.deepEqual(pending.scenarioFlags.combinedHarmPackets,s.scenarioFlags.combinedHarmPackets)}
 assert.deepEqual(s.scenarioFlags.combinedHarmPackets,[{damage:1,horror:1}]);assert.equal(s.investigators[0].damage,1);assert.equal(s.investigators[0].horror,1)
})
