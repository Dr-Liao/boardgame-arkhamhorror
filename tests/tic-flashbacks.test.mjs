import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { scenarioRuntime, legalMoves, revealLocation } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
const json = value => JSON.parse(JSON.stringify(value))
function transaction(s,execute,select=()=>null){resolveTransaction(s,0,{action:'testTicFlashback'},execute);for(let guard=0;s.pendingChoice;guard++){assert.ok(guard<70);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:select(c)??c.options.find(o=>['skip','done','self'].includes(o.id))?.id??c.options[0].id},execute)}}
for(const [id,memory,token] of [[1,'AMeetingWithThomasDawson'],[2,'ABattleWithAHorrifyingDevil','cultist'],[3,'ADecisionToStickTogether','tablet'],[4,'AnEncounterWithASecretCult','elderthing']])test(`P7 actual chapter Flashback${id} records the printed memory and permanently removes only one matching symbol`,()=>{
 const s=chapterFixture('thePitOfDespair');s.chaosBag=['0','cultist','cultist','tablet','tablet','elderthing','elderthing'];s.campaign.chaosBag=[...s.chaosBag]
 transaction(s,d=>scenarioRuntime(d,[]).resolveFlashback(0,'flashback'+id))
 assert.ok(s.campaign.records.memoriesRecovered.includes(memory));assert.equal(s.chaosBag.length,token?6:7);assert.deepEqual(s.chaosBag,s.campaign.chaosBag)
 assert.equal(scenarioRuntime(s,[]).resolveFlashback(0,'flashback'+id),false)
})
for(const take of [false,true])test(`P7 FlashbackVI ${take?'accepts the same local investigator':'declines the optional campaign card'} without creating a second card`,()=>{
 const s=chapterFixture('inTooDeep',2);const location=s.locations.find(l=>l.code==='07135');for(const inv of s.investigators)inv.location=location.id
 transaction(s,d=>scenarioRuntime(d,[]).resolveFlashback(1,'flashback6'),c=>c.source==='flashback6'?(take?'take':'decline'):c.kind==='investigator'?'1':null)
 const inv=s.investigators[1];assert.equal(inv.assets.some(a=>a.code==='07151'),take);assert.ok(s.campaign.records.memoriesRecovered.includes('AFollowedLead'))
 assert.equal(s.scenarioZones.setAside.includes('07151'),!take)
 if(take)assert.ok(s.campaign.investigators[1].deck.includes('07151'))
})
test('P7 FlashbackV gives the physical Joe to a chosen local investigator; VII/VIII change the permanent bag once',()=>{
 const s=chapterFixture('inTooDeep',2);const square=s.locations.find(l=>l.code==='07139');for(const inv of s.investigators)inv.location=square.id
 transaction(s,d=>scenarioRuntime(d,[]).resolveFlashback(0,'flashback5'),c=>c.kind==='investigator'?'1':null)
 assert.equal(s.investigators[1].assets.find(a=>a.code==='07150').uses,3);assert.equal(s.scenarioZones.setAside.includes('07150'),false)
 assert.equal(s.campaign.investigators[1].deck.includes('07150'),false)
 s.chaosBag=['0','cultist','cultist','tablet'];s.campaign.chaosBag=[...s.chaosBag]
 transaction(s,d=>scenarioRuntime(d,[]).resolveFlashback(0,'flashback7'))
 transaction(s,d=>scenarioRuntime(d,[]).resolveFlashback(1,'flashback8'),c=>c.source==='flashback'?'cultist':null)
 assert.deepEqual(s.chaosBag,['0','cultist','tablet','+1']);assert.deepEqual(s.campaign.chaosBag,s.chaosBag)
})
for(const [id,memory,color,code] of [[9,'DiscoveryOfAStrangeIdol','purple','07179'],[10,'DiscoveryOfAnUnholyMantle','white','07180'],[11,'DiscoveryOfAMysticalRelic','black','07181']])test(`P7 Flashback${id} gives the actual set-aside relic and links its physical identity to the key through JSON`,()=>{
 const s=chapterFixture('devilReef',2),api=createMechanicsApi(s),here=s.investigators[0].location
 api.keys.transfer(color,'setAside',`location:${here}`,{reveal:true})
 transaction(s,d=>scenarioRuntime(d,[]).resolveFlashback(0,'flashback'+id))
 const relic=s.investigators[0].assets.find(a=>a.code===code);assert.ok(relic);assert.ok(s.campaign.records.memoriesRecovered.includes(memory));assert.equal(s.scenarioZones.setAside.includes(code),false)
 assert.equal(api.keys.transfer(color,'investigator:0','investigator:1'),true);assert.equal(s.investigators[1].assets.find(a=>a.code===code).id,relic.id)
 const e=enemy(s,{engagedSeat:null,location:here});api.keys.transfer(color,'investigator:1',`enemy:${e.id}`)
 assert.equal(s.investigators[1].assets.some(a=>a.code===code),false);assert.equal(s.storyAssets.find(a=>a.id===relic.id).near,`enemy:${e.id}`)
 const saved=JSON.parse(JSON.stringify(s)),savedApi=createMechanicsApi(saved);savedApi.keys.transfer(color,`enemy:${e.id}`,'investigator:0')
 assert.equal(saved.investigators[0].assets.find(a=>a.code===code).id,relic.id)
 savedApi.keys.transfer(color,'investigator:0',`act:${saved.acts[saved.actIndex].id}`);assert.ok(saved.removedFromGame.includes(code));assert.equal(saved.investigators[0].assets.some(a=>a.id===relic.id),false)
 savedApi.keys.transfer(color,`act:${saved.acts[saved.actIndex].id}`,'investigator:1');assert.equal(saved.investigators[1].assets.some(a=>a.id===relic.id),false)
})
for(const [id,code,color,memory] of [[12,'07242','white','AConversationWithMrMoore'],[13,'07248','purple','TheLifecycleOfADeepOne']])test(`P7 actual location Flashback${id} removes a selected symbol permanently and XII gives clues to the lead`,()=>{
 const s=chapterFixture('aLightInTheFog',2);const api=scenarioRuntime(s,[]);let location=s.locations.find(l=>l.code===code)
 if(!location){const def=Object.entries(s.scenario.locations).find(([,l])=>l.code===code);api.place(def[0]);location=s.locations.find(l=>l.code===code)}
 transaction(s,d=>revealLocation(d,location.id,[],1));s.currentSeat=1;s.investigators[1].location=location.id
 assert.equal(createMechanicsApi(s).keys.transfer(color,s.scenarioFlags.mechanics.keys[color].holder,'investigator:1',{reveal:true}),true)
 s.chaosBag=['0','cultist','cultist','tablet'];s.campaign.chaosBag=[...s.chaosBag]
 const clues=s.investigators[0].clues;const command=legalMoves(s).find(m=>m.entityId===location.id);assert.ok(command)
 move(s,command);settle(s,c=>c.source==='flashback'?'cultist':null)
 assert.ok(s.campaign.records.memoriesRecovered.includes(memory));assert.equal(s.chaosBag.filter(t=>t==='cultist').length,1);assert.deepEqual(s.chaosBag,s.campaign.chaosBag)
 assert.equal(s.investigators[0].clues,clues+(id===12?2:0))
})

const actualDepths={ '07175a':[['red','blue'],2,'purple','07179','flashback9'],'07175b':[['green','yellow'],3,'purple','07179','flashback9'],
 '07176a':[['red','yellow'],2,'white','07180','flashback10'],'07176b':[['blue','green'],3,'white','07180','flashback10'],
 '07177a':[['red','green'],2,'black','07181','flashback11'],'07177b':[['blue','yellow'],3,'black','07181','flashback11'] }
test('P7 real selected Depth locations pay local group clues and invoke their actual relic flashback',()=>{
 const base=chapterFixture('devilReef',2),api=scenarioRuntime(base,[]),m=createMechanicsApi(base)
 const locations=m.scenarioDecks.take('unfathomableDepths',3)
 for(const id of locations){api.place(id);transaction(base,d=>revealLocation(d,id,[],0))}
 for(const id of locations){
  // 每个地点在「三处深处都已揭示」的同一初始局面的副本上单独验证：真正的印刷规则是
  // 「控制紫/白/黑三把钥匙就推进」（见下一个用例），所以三个遗物拿齐会合法地结束本章，
  // 不能拿前一地点的结果继续验下一个地点。
  const s=json(base),concrete=createMechanicsApi(s)
  const location=s.locations.find(l=>l.id===id),[required,n,color,code,flashback]=actualDepths[location.originalCode]
  for(const inv of s.investigators){inv.location=id;inv.clues=n}
  for(const requiredColor of required)assert.equal(concrete.keys.transfer(requiredColor,s.scenarioFlags.mechanics.keys[requiredColor].holder,'investigator:0',{reveal:true}),true)
  const actions=s.investigators[0].actionsLeft,command=legalMoves(s).find(move=>move.entityId===id);assert.ok(command)
  move(s,command);settle(s)
  assert.equal(s.investigators[0].actionsLeft,actions);assert.equal(s.investigators.reduce((sum,inv)=>sum+inv.clues,0),0)
  assert.ok(s.investigators[0].assets.some(a=>a.code===code));assert.ok(s.scenarioFlags.resolvedFlashbacks.includes(flashback));assert.ok(concrete.keys.at('investigator:0').includes(color))
  assert.equal(legalMoves(s).some(move=>move.entityId===id),false)
  assert.equal(s.scenario.id,'devilReef','claimed relics alone must not advance the act')
 }
})
test('P7 controlling all three relics completes the printed Devil Reef act and hands the campaign to interlude3',()=>{
 const s=chapterFixture('devilReef',2),api=scenarioRuntime(s,[]),m=createMechanicsApi(s)
 const locations=m.scenarioDecks.take('unfathomableDepths',3)
 for(const id of locations){api.place(id);transaction(s,d=>revealLocation(d,id,[],0))}
 for(const id of locations){
  const location=s.locations.find(l=>l.id===id),[required,n]=actualDepths[location.originalCode]
  for(const inv of s.investigators){inv.location=id;inv.clues=n}
  for(const requiredColor of required)m.keys.transfer(requiredColor,s.scenarioFlags.mechanics.keys[requiredColor].holder,'investigator:0',{reveal:true})
  const command=legalMoves(s).find(move=>move.entityId===id);assert.ok(command);move(s,command);settle(s)
 }
 assert.deepEqual([...s.campaign.records.memoriesRecovered].sort(),
  ['DiscoveryOfAMysticalRelic','DiscoveryOfAStrangeIdol','DiscoveryOfAnUnholyMantle'])
 assert.equal(s.campaign.records.TheTerrorOfDevilReefIsStillAlive,true,'agenda 1 never advanced, so the printed terror record stands')
 assert.deepEqual(s.campaign.flow.history.map(entry=>entry.nodeId),['devilReef','interlude3','horrorInHighGear'])
 assert.equal(s.scenario.id,'horrorInHighGear')
})

