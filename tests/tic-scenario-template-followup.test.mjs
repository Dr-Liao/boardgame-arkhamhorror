import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle } from './core-fixture.mjs'
import { scenarioRuntime, revealLocation, syncLocationTraitLinks, legalMoves, validateMove } from '../src/engine/engine.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { evadeTraitAndDrainLocation } from '../src/cards/encounter-entries/_shared.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
registerCardAbilities([{code:'testTicTraitEntry',scope:'location',locationRule:{connectsToTrait:'Cave'}},{code:'testTicSanctumTemplate',scope:'location',abilities:[{kind:'free',actionKind:'activate',resolve:evadeTraitAndDrainLocation}]}])
test('P7 remembered facts are deduplicated and survive JSON',()=>{
 const s=fixture(),api=scenarioRuntime(s,[])
 assert.equal(api.remember('UnlockedTheThirdFloor'),true)
 assert.equal(api.remember('UnlockedTheThirdFloor'),false)
 const saved=JSON.parse(JSON.stringify(s));assert.equal(scenarioRuntime(saved,[]).remember('UnlockedTheThirdFloor'),false)
 assert.deepEqual(saved.scenarioFlags.remembered,['UnlockedTheThirdFloor'])
 assert.throws(()=>api.remember(''))
})
test('P7 sanctum template evades every Ancient One and permanently drains only the physical source',()=>{
 const s=fixture(),api=scenarioRuntime(s,[]),mechanics=createMechanicsApi(s),loc=s.locations[0]
 const first=enemy(s,{traits:['Ancient One']}),second=enemy(s,{traits:['Ancient One'],engagedSeat:null}),other=enemy(s,{traits:['Deep One']})
 Object.assign(loc,{code:'testTicSanctumTemplate',originalCode:'testTicSanctumTemplate',revealed:true})
 mechanics.water.set(loc.id,2)
 move(s,legalMoves(s).find(m=>m.action==='entityAbility'));settle(s)
 const actual=id=>s.enemies.find(e=>e.id===id)
 assert.equal(actual(first.id).exhausted,true);assert.equal(actual(first.id).engagedSeat,null);assert.equal(actual(second.id).exhausted,true);assert.notEqual(actual(other.id).exhausted,true)
 assert.equal(mechanics.water.level(loc.id),0);assert.equal(mechanics.water.change(loc.id,2),false)
})
test('P7 trait-linked entry connects both ways to newly placed caves and preserves independent links',()=>{
 const s=fixture(),entry=s.locations[0]
 Object.assign(entry,{code:'testTicTraitEntry',originalCode:'testTicTraitEntry',revealed:false,connections:[]})
 s.locations=[entry,{id:'firstCave',code:'01112',revealed:true,traits:['Cave'],connections:[]},{id:'otherRoom',code:'01112',revealed:true,traits:['Building'],connections:[]}]
 syncLocationTraitLinks(s);assert.deepEqual(entry.connections,[])
 revealLocation(s,entry.id,[],0)
 assert.ok(entry.connections.includes('firstCave'));assert.ok(s.locations[1].connections.includes(entry.id));assert.ok(!entry.connections.includes('otherRoom'))
 s.scenario.locations={...s.scenario.locations,newCave:{name:'New cave',code:'01112',revealed:true,traits:['Cave'],connections:['otherRoom']}}
 scenarioRuntime(s,[]).place('newCave')
 assert.ok(entry.connections.includes('newCave'));assert.ok(s.locations.find(l=>l.id==='newCave').connections.includes(entry.id))
 assert.ok(s.locations.find(l=>l.id==='newCave').connections.includes('otherRoom'))
 const command=legalMoves(s).find(m=>m.action==='move'&&m.locationId==='newCave');assert.ok(command);assert.equal(validateMove(s,0,command),null)
 const saved=JSON.parse(JSON.stringify(s));syncLocationTraitLinks(saved);assert.deepEqual(saved.locationTraitLinks,s.locationTraitLinks)
})

