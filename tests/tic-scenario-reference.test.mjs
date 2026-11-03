import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { scenarioReferenceEntry } from '../src/cards/encounter-entries/_shared.js'
import { legalMoves, validateMove, performTest } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerContentBundle, contentRegistry } from '../content/registered.js'
import { entryRules } from '../content/campaigns/theInnsmouthConspiracy/entry-rules.js'
const id='testTicScenarioReference'
const campaign=structuredClone(contentRegistry.getCampaign('nightOfTheZealot'));Object.assign(campaign,{id,status:'development',scenarioIds:[id],unlock:{[id]:[]}});delete campaign.flow
const scenario=structuredClone(contentRegistry.getScenarioData('theGathering'));Object.assign(scenario,{id,campaignId:id,code:id,originalCode:id,referenceCode:id})
const manifest=structuredClone(contentRegistry.getScenario('theGathering'));Object.assign(manifest,{id,campaignId:id,status:'development',behaviorIds:[id]});delete manifest.referenceCode
registerContentBundle({campaigns:[campaign],scenarios:[{scenario,manifest,behavior:{...entryRules,id}}]})
registerCardAbilities([
 scenarioReferenceEntry({code:id,scenarioRule:{trackTestTarget:true,
  resolveChaosToken:(s,inv,token)=>token==='cultist'?{delta:0,drawAnother:true,onDraw:[{type:'scenarioToken',event:'draw'}]}:undefined,
  applyTokenEffect:(s,inv,fx,api)=>api.gainResources(inv.seat,1),
  testAutoFail:(s,inv,ctx)=>!ctx.ignoredSymbols&&ctx.resolvedTokens.includes('cultist')&&ctx.drawn.includes('curse'),
  afterTest:(s,inv,result,api,context)=>{assert.equal(s.skillTest,null);api.setScenarioFlag('testScenarioAfterResult',result.success);if(context.test.target)api.setScenarioFlag('referenceTestTarget',context.test)},
 }}),
 {code:'testTicBlockKeyClaim',scope:'act',actRule:{keyClaimBlockedTraits:["Y'ha-nthlei"]}},
])
function board(){const s=fixture('01001',2);Object.assign(s.scenario,{id,code:id,originalCode:id,referenceCode:id});s.humanSeats=[0,1];return s}
test('P7 scenario reference exposes real free key claim and give actions with the existing colored selector',()=>{
 const s=board(),api=createMechanicsApi(s),here=s.investigators[0].location;s.locations.find(l=>l.id===here).clues=0
 api.keys.initialize([{color:'red',holder:`location:${here}`,revealed:false}]);const before=s.investigators[0].actionsLeft
 let command=legalMoves(s).find(m=>m.entityType==='scenario'&&m.abilityIndex===0);assert.ok(command);move(s,command)
 assert.equal(s.pendingChoice.kind,'mechanic');assert.equal(s.pendingChoice.options.find(o=>o.id==='pick:0').keyColor,'unrevealed')
 settle(s,c=>c.options.some(o=>o.id==='confirm')?'confirm':c.options.some(o=>o.id==='pick:0')?'pick:0':null)
 assert.deepEqual(api.keys.at('investigator:0'),['red']);assert.equal(s.investigators[0].actionsLeft,before)
 command=legalMoves(s).find(m=>m.entityType==='scenario'&&m.abilityIndex===1);assert.ok(command);move(s,command)
 settle(s,c=>c.options.some(o=>o.id==='confirm')?'confirm':c.options.some(o=>o.id==='pick:0')?'pick:0':null)
 assert.deepEqual(api.keys.at('investigator:1'),['red']);assert.equal(s.investigators[0].actionsLeft,before)
})
test('P7 active-act trait restriction blocks only generic key pickup, retaining scripted printed transfers',()=>{
 const s=board(),api=createMechanicsApi(s),loc=s.locations[0];loc.clues=0;loc.traits=["Y'ha-nthlei"];s.acts=[{id:'testClaimAct',code:'testTicBlockKeyClaim'}];s.actIndex=0
 api.keys.initialize([{color:'purple',holder:`location:${loc.id}`,revealed:true}]);assert.equal(legalMoves(s).some(m=>m.entityType==='scenario'&&m.abilityIndex===0),false)
 assert.notEqual(validateMove(s,0,{action:'entityAbility',entityId:id,abilityIndex:0}),null);assert.equal(api.keys.claim(0,'purple'),false)
 assert.equal(api.keys.transfer('purple',`location:${loc.id}`,'investigator:0',{reveal:true}),true)
})
for(const order of [['cultist','curse','0'],['curse','cultist','0']])test(`P7 scenario token effects and whole-chain auto-fail use actual ${order.join('→')}`,()=>{
 const s=board();s.humanSeats=[];s.rngState=0;s.chaosBag=[...order];s.investigators[0].willpower=20;const before=s.investigators[0].resources
 const execute=d=>performTest(d,0,'willpower',1,{resolve:()=>{}})
 resolveTransaction(s,0,{action:'testScenarioToken'},execute)
 for(let guard=0;s.pendingChoice;guard++){assert.ok(guard<40);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:c.options.find(o=>['done','skip','self'].includes(o.id))?.id??c.options[0].id},execute)}
 assert.equal(s.lastTestResult.autoFail,true);assert.equal(s.investigators[0].resources,before+1);assert.equal(s.scenarioFlags.testScenarioAfterResult,false)
})

test('P7 reference rules receive the real typed target without a player asset and retain it after test close',()=>{
 const s=board(),e=enemy(s,{health:30});s.investigators[0].combat=20;s.chaosBag=['0']
 move(s,legalMoves(s).find(move=>move.action==='fight'&&move.enemyId===e.id));settle(s)
 assert.deepEqual(s.scenarioFlags.referenceTestTarget,{actionKind:'fight',target:{kind:'enemy',id:e.id},failedBy:0})
})
