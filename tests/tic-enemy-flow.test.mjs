import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture,enemy,asset} from './core-fixture.mjs'
import {chapterFixture} from './tic-chapter-fixture.mjs'
import {scenarioRuntime,enemyFightValue} from '../src/engine/engine.js'
import {registerCardAbilities} from '../src/engine/ability.js'
import {resolveTransaction} from '../src/engine/resolution.js'
registerCardAbilities([{code:'testTicAura',scope:'enemy',modifiers:[{target:'enemyFight',amount:1,audience:'enemies',condition:{when:({state,source,entity})=>source.id!==entity.id&&source.engagedSeat==null&&(source.location===entity.location||state.locations.find(l=>l.id===source.location)?.connections.includes(entity.location))}}]}])
function run(s,execute){resolveTransaction(s,0,{action:'testFlow'},execute);for(let n=0;s.pendingChoice;n++){assert.ok(n<40);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:(c.options.find(o=>['skip','done'].includes(o.id))||c.options[0]).id},execute)}}
test('P7 nearest enemy query and Massive engagement use live engine semantics',()=>{
 const s=fixture('01001',2),api=scenarioRuntime(s,[]);s.locations=[{id:'a',connections:['b']},{id:'b',connections:['a']},{id:'c',connections:[]}];s.investigators[0].location='a';s.investigators[1].location='b'
 const a=enemy(s,{location:'b',engagedSeat:null,massive:true}),b=enemy(s,{location:'c',engagedSeat:null})
 assert.deepEqual(api.nearestEnemies('a').map(e=>e.id),[a.id]);assert.equal(api.isEnemyUnengaged(a),false)
 assert.deepEqual(api.nearestEnemies('a',{predicate:e=>api.isEnemyUnengaged(e)}),[])
 assert.deepEqual(api.nearestEnemies('a',{predicate:e=>api.isEnemyUnengaged(e),fallback:true}).map(e=>e.id),[b.id])
 a.textBlanked={round:s.round,phase:s.phase};assert.equal(api.isEnemyUnengaged(a),true)
})
test('P7 enemy auras stack, observe source blanking and never count twice as self modifiers',()=>{
 const s=fixture(),inv=s.investigators[0];s.locations=[{id:'a',connections:['b']},{id:'b',connections:['a']}];inv.location='a'
 const target=enemy(s,{location:'b',engagedSeat:null}),a=enemy(s,{code:'testTicAura',location:'a',engagedSeat:null}),b=enemy(s,{code:'testTicAura',location:'a',engagedSeat:null})
 assert.equal(enemyFightValue(s,target,inv),3);assert.equal(enemyFightValue(s,a,inv),2)
 target.textBlanked={round:s.round,phase:s.phase};assert.equal(enemyFightValue(s,target,inv),3)
 a.textBlanked={round:s.round,phase:s.phase};assert.equal(enemyFightValue(s,target,inv),2)
 b.engagedSeat=0;assert.equal(enemyFightValue(s,target,inv),1)
 delete a.textBlanked;a.location='missing';assert.equal(enemyFightValue(s,target,inv),1)
})
test('P7 printed enemy Surge draws once after spawn, suppression lasts one physical draw only',()=>{
 const s=chapterFixture('aLightInTheFog');s.encounterDeck=['dissonantVoices','07255'];s.encounterDiscard=[]
 run(s,d=>scenarioRuntime(d,[]).drawEncounter(0))
 assert.equal(s.enemies.filter(e=>e.code==='07255').length,1);assert.equal(s.encounterDeck.length,0);assert.equal(s.investigators[0].threat.filter(t=>t.code==='dissonantVoices').length,1)
 const t=chapterFixture('aLightInTheFog');t.encounterDeck=['dissonantVoices','07255','07255'];t.encounterDiscard=[]
 run(t,d=>scenarioRuntime(d,[]).drawEncounter(0,{suppressSurge:true}));assert.equal(t.encounterDeck.length,2)
 run(t,d=>scenarioRuntime(d,[]).drawEncounter(0));assert.equal(t.encounterDeck.length,0);assert.equal(t.enemies.filter(e=>e.code==='07255').length,2)
})
