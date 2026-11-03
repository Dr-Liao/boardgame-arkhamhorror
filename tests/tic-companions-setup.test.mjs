import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { HIDEOUTS } from '../content/campaigns/theInnsmouthConspiracy/role-data.js'
import { chapterData,physicalLocationId } from '../content/campaigns/theInnsmouthConspiracy/chapter-definition.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { limitKey,normalizeLimit,markLimitUsed,limitUsed } from '../src/engine/limits.js'
import { resolveFlashback } from '../content/campaigns/theInnsmouthConspiracy/flashbacks.js'
import { scenarioRuntime } from '../src/engine/engine.js'

for(const id of ['devilReef','theLairOfDagon','horrorInHighGear']) test('P7 '+id+' reload keeps permanent Harper ownership and complete opening hand',()=>{
 const deck=['07083',...Array(14).fill('01088')]
 const s=chapterFixture(id,1,{investigatorRecords:{0:{deck,storyCards:['07083']}}}),inv=s.investigators[0]
 assert.equal(inv.hand.length,5)
 assert.deepEqual(s.campaign.investigators[0].deck,deck)
 assert.deepEqual(s.campaign.investigators[0].storyCards,['07083'])
 const playable=[...inv.deck,...inv.hand,...inv.discard,...inv.assets.map(a=>a.code)]
 assert.equal(playable.filter(c=>c==='07083').length,id==='horrorInHighGear'?1:0)
 assert.equal((s.scenarioZones.limbo||[]).filter(c=>c==='07083').length,id==='horrorInHighGear'?0:1)
 assert.equal(JSON.parse(JSON.stringify(s)).campaign.investigators[0].deck.includes('07083'),true)
})
for(const success of [true,false]) test('P7 Reef Dawson is temporary '+(success?'extra starting card':'shuffled card'),()=>{
 const records=success?{TheMissionWasSuccessful:true}:{TheMissionFailed:true}
 const s=chapterFixture('devilReef',1,{records}),inv=s.investigators[0]
 assert.equal(s.campaign.investigators[0].deck.includes('07082'),false)
 assert.equal((s.campaign.investigators[0].storyCards||[]).includes('07082'),false)
 const all=[...inv.deck,...inv.hand,...inv.discard,...inv.assets.map(a=>a.code)]
 assert.equal(all.filter(c=>c==='07082').length,1)
 assert.equal(inv.hand.length,success?6:5)
 if(success)assert.equal(inv.hand.includes('07082'),true)
})
test('P7 Deep random keys never include an unrecorded black key',()=>{
 const s=chapterFixture('inTooDeep'),api=createMechanicsApi(s),holder='location:'+s.investigators[0].location
 for(let i=0;i<6;i++)assert.equal(api.keys.placeRandom(holder),true)
 assert.equal(api.keys.placeRandom(holder),false)
 assert.equal(s.scenarioFlags.mechanics.keys.black.holder,'removed')
 assert.equal(api.keys.at(holder,{reveal:true}).length,6)
})
for(const [code,role]of Object.entries(HIDEOUTS))test('P7 black key uses recorded hideout '+role,()=>{
 const s=chapterFixture('inTooDeep',1,{records:{harperHideout:role}})
 assert.equal(s.scenarioFlags.mechanics.keys.black.holder,'location:'+physicalLocationId(chapterData.inTooDeep.blackKeyMap[code]))
 assert.equal(s.scenarioFlags.mechanics.keys.black.revealed,true)
})
test('P7 Harper places global story and both reserved companions',()=>{
 const s=chapterFixture('theVanishingOfElinaHarper')
 for(const c of ['07082','07083'])assert.equal(s.scenarioZones.setAside.filter(code=>code===c).length,1)
 assert.equal(s.storyAssets.filter(c=>(c.originalCode||c.code)==='07062a').length,1)
})
test('P7 story presentation contains its whole body',()=>{
 const s=chapterFixture('thePitOfDespair'),events=[]
 resolveFlashback(s,0,'flashback1',scenarioRuntime(s,events))
 const event=events.find(e=>e.presentation?.kind==='story')
 assert.ok(event)
 assert.equal(event.presentation.text,event.text)
 assert.ok(event.presentation.text.length>event.presentation.title.length)
})
test('P7 investigator-instance limit separates actors and physical sources after JSON',()=>{
 const s=chapterFixture('intoTheMaelstrom',2),descriptor={code:'testLimit',limit:normalizeLimit({scope:'perRound',owner:'investigatorInstance'})}
 const a={id:'physicalA'},b={id:'physicalB'},inv=s.investigators[0],other=s.investigators[1]
 markLimitUsed(s,inv,descriptor,null,null,a)
 assert.equal(limitUsed(s,inv,descriptor,null,null,a),true)
 assert.equal(limitUsed(s,inv,descriptor,null,null,b),false)
 assert.equal(limitUsed(s,other,descriptor,null,null,a),false)
 assert.equal(limitUsed(JSON.parse(JSON.stringify(s)),inv,descriptor,null,null,a),true)
 assert.notEqual(limitKey(s,inv,descriptor,null,null,a),limitKey(s,other,descriptor,null,null,a))
})
