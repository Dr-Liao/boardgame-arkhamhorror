import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, asset, move, settle } from './core-fixture.mjs'
import { scenarioRuntime, slotUsage, canEquip } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
test('P7 physical encounter take and set-aside-to-hand do not draw or enter play',()=>{
 const s=fixture(),api=scenarioRuntime(s,[]);s.encounterDeck=['ghoulMinion','dissonantVoices','ghoulMinion'];s.encounterDiscard=[]
 assert.equal(api.takeEncounterDeckCard('ghoulMinion'),'ghoulMinion');assert.deepEqual(s.encounterDeck,['ghoulMinion','dissonantVoices']);assert.equal(api.takeEncounterDeckCard('absent'),null);assert.deepEqual(s.encounterDiscard,[]);assert.equal(s.enemies.length,0)
 s.scenarioZones.setAside=['07279','07180'];const before=s.investigators[0].assets.length
 assert.equal(api.takeSetAsideToHand(0,'07180'),true);assert.equal(api.takeSetAsideToHand(0,'07180'),false)
 assert.deepEqual(s.investigators[0].hand,['07180']);assert.deepEqual(s.scenarioZones.setAside,['07279']);assert.equal(s.investigators[0].assets.length,before)
})
test('P7 an instance ally-slot exemption leaves other copies occupying slots and survives JSON',()=>{
 const s=fixture(),a=asset(s,'01033'),api=scenarioRuntime(s,[])
 assert.equal(slotUsage(s.investigators[0]).ally,1);assert.equal(api.exemptAssetSlot(a,'ally'),true)
 assert.equal(slotUsage(s.investigators[0]).ally,undefined);assert.equal(canEquip(s.investigators[0],ALL_CARDS['01033']),true)
 asset(s,'01033');assert.equal(slotUsage(s.investigators[0]).ally,1)
 const saved=JSON.parse(JSON.stringify(s));assert.equal(slotUsage(saved.investigators[0]).ally,1)
})
test('P7 exactly the next actual upkeep skips enemy ready; a same-round repeated upkeep readies it',()=>{
 const s=fixture(),e=enemy(s,{engagedSeat:null,exhausted:true,damage:0,horror:0}),api=scenarioRuntime(s,[])
 asset(s,'02305',{id:'p7-watch'});api.preventEnemyReadyNextUpkeep(e)
 let sawFirst=false
 move(s,{action:'endTurn'})
 settle(s,(choice,state)=>{
   if(choice.source==='p7-watch'&&choice.prompt.includes('重复重整')) {
     assert.equal(state.enemies.find(x=>x.id===e.id).exhausted,true)
     assert.equal(state.enemies.find(x=>x.id===e.id).skipNextUpkeepReady,undefined)
     sawFirst=true;return 'trigger'
   }
   return null
 })
 assert.equal(sawFirst,true);assert.equal(s.enemies.find(x=>x.id===e.id).exhausted,false)
})
