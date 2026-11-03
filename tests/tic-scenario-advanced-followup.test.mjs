import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { scenarioRuntime, legalMoves, validateMove, enemyHealth, damageEnemy, revealLocation } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
registerCardAbilities([
 {code:'testTicRevealedFloodBound',scope:'location',locationRule:{floodBounds:{max:1,onlyRevealed:true},onReveal:(s,l,api)=>api.mechanics.water.change(l.id,1)}},
 {code:'testTicSharedThreat',scope:'treachery',teamActivatable:true,abilities:[{kind:'free',actionKind:'activate',cost:{resources:1},resolve:({inv,source,api})=>{api.gainResources(inv.seat,2);api.removeThreat(source)}}]},
])
test('P7 revealed-only flood bounds do not disclose a hidden identity or prevent a hidden full flood',()=>{
 const s=fixture(),loc=s.locations[0],api=createMechanicsApi(s);Object.assign(loc,{code:'testTicRevealedFloodBound',originalCode:'testTicRevealedFloodBound',revealed:false})
 assert.equal(api.water.set(loc.id,2),2);assert.equal(api.water.level(loc.id),2)
 revealLocation(s,loc.id,[],0);assert.equal(api.water.level(loc.id),1);assert.equal(api.water.canChange(loc.id,1),false)
})
test('P7 a teammate can activate a shared threat, paying their own costs and removing the same physical card',()=>{
 const s=fixture('01001',2);s.humanSeats=[0,1];s.investigators[1].threat.push({id:'sharedThreatPhysical',code:'testTicSharedThreat'})
 const before=s.investigators[0].resources,other=s.investigators[1].resources
 const command=legalMoves(s).find(m=>m.assetId==='sharedThreatPhysical');assert.ok(command);assert.equal(command.ownerSeat,1)
 const remote=JSON.parse(JSON.stringify(s));remote.investigators[1].location='remote';assert.notEqual(validateMove(remote,0,command),null)
 move(s,command);settle(s);assert.equal(s.investigators[0].resources,before+1);assert.equal(s.investigators[1].resources,other);assert.equal(s.investigators[1].threat.length,0)
})
test('P7 choosing a reference key reuses the colored selector, is optional and survives pending JSON',()=>{
 const s=fixture(),api=createMechanicsApi(s);api.keys.initialize([{color:'blue',holder:'reference',revealed:true},{color:'white',holder:'reference',revealed:true}])
 const execute=d=>{const api=createMechanicsApi(d);const color=api.interactions.chooseKey(0,api.keys.at('reference'),{optional:true,source:'testTicKeySelector'});if(color)api.keys.transfer(color,'reference','investigator:0',{reveal:true})}
 resolveTransaction(s,0,{action:'testTicKeySelector'},execute);assert.ok(s.pendingChoice.options.some(o=>o.keyColor==='white'));const saved=JSON.parse(JSON.stringify(s))
 const c=s.pendingChoice;resolveTransaction(s,0,{action:'choose',choiceId:c.id,optionId:'cancel'},execute);assert.deepEqual(createMechanicsApi(s).keys.at('reference'),['blue','white'])
 let choice=saved.pendingChoice;resolveTransaction(saved,0,{action:'choose',choiceId:choice.id,optionId:'pick:1'},execute);choice=saved.pendingChoice;resolveTransaction(saved,0,{action:'choose',choiceId:choice.id,optionId:'confirm'},execute)
 assert.deepEqual(createMechanicsApi(saved).keys.at('investigator:0'),['white'])
})
test('P7 an enemy with no printed health accumulates damage and survives automatic damage defeat after JSON',()=>{
 const s=fixture(),e=enemy(s,{health:null});assert.equal(enemyHealth(s,e),null)
 assert.equal(damageEnemy(s,e,100,0,[]),true);assert.ok(s.enemies.includes(e));assert.equal(e.damageTaken,100)
 s.investigators[0].combat=20;move(s,legalMoves(s).find(m=>m.action==='fight'&&m.enemyId===e.id));settle(s)
 const actual=s.enemies.find(x=>x.id===e.id);assert.ok(actual);assert.equal(actual.damageTaken,101);assert.equal(enemyHealth(s,actual),null)
 const saved=JSON.parse(JSON.stringify(s));assert.equal(enemyHealth(saved,saved.enemies[0]),null)
})
