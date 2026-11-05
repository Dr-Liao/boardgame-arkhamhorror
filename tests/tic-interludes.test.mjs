import test from 'node:test'
import assert from 'node:assert/strict'
import './tic-chapter-fixture.mjs'
import { fixture } from './core-fixture.mjs'
import { manifest } from '../content/campaigns/theInnsmouthConspiracy/manifest.js'
import { walkCampaign } from '../src/campaign/campaign-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { resolveTransaction } from '../src/engine/resolution.js'
function run(s,event,select=()=>null){
 const graph={...manifest,flow:{start:event,nodes:{[event]:{type:'interlude',next:'end',effects:[{type:'registered',handler:'innsmouthInterludes',event}]},end:{type:'end'}}}}
 const execute=d=>walkCampaign(d.campaign,graph,()=>{throw Error('unexpected flow choice')},effect=>applyCampaignEffect(d,effect,()=>{}))
 resolveTransaction(s,0,{action:'testTicInterlude'},execute)
 for(let guard=0;s.pendingChoice;guard++){assert.ok(guard<40);const c=s.pendingChoice;resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId:select(c)??c.options[0].id},execute)}
 return execute
}
const first=['AMeetingWithThomasDawson','ABattleWithAHorrifyingDevil','ADecisionToStickTogether','AnEncounterWithASecretCult']
const all=[...first,'ADealWithJoeSargent','AFollowedLead','AnIntervention','AJailbreak','DiscoveryOfAStrangeIdol','DiscoveryOfAnUnholyMantle','DiscoveryOfAMysticalRelic','AConversationWithMrMoore','TheLifecycleOfADeepOne','AStingingBetrayal']
for(let mask=0;mask<16;mask++)test(`P7 interlude I memory combination ${mask} grants exact XP once and survives JSON`,()=>{
 const s=fixture('01001',2);delete s.campaign.flow;s.campaign.records.memoriesRecovered=first.filter((_,i)=>mask&(1<<i));const before=s.campaign.investigators[0].xp
 const execute=run(s,'interlude1'),n=s.campaign.records.memoriesRecovered.length
 for(const inv of Object.values(s.campaign.investigators))assert.equal(inv.xp,before+n)
 const saved=JSON.parse(JSON.stringify(s));execute(saved);assert.equal(saved.campaign.investigators[0].xp,before+n);assert.ok(saved.campaign.flow.history[0].storyText.length>100)
})
for(let mask=0;mask<8;mask++)test(`P7 interlude III key argument ${mask} gives exact permanent symbols and 2 XP per recovered relic`,()=>{
 const s=fixture('01001',2);delete s.campaign.flow;const colors=['purple','white','black'].filter((_,i)=>mask&(1<<i));s.campaign.flowPayload={recoveredKeys:colors};s.chaosBag=['0'];s.campaign.chaosBag=['0']
 const before=s.campaign.investigators[0].xp;run(s,'interlude3')
 for(const inv of Object.values(s.campaign.investigators))assert.equal(inv.xp,before+colors.length*2)
 assert.equal(s.chaosBag.length,1+colors.length);assert.deepEqual(s.chaosBag,s.campaign.chaosBag)
 for(const [i,record]of ['TheIdolWasBroughtToTheLighthouse','TheMantleWasBroughtToTheLighthouse','TheHeaddressWasBroughtToTheLighthouse'].entries())assert.equal(!!s.campaign.records[record],!!(mask&(1<<i)))
})
test('P7 interlude II successful mission adds exactly one physical campaign Harper to a selected investigator',()=>{
 const s=fixture('01001',2);delete s.campaign.flow;s.campaign.records.TheMissionWasSuccessful=true
 run(s,'interlude2',()=> '1');assert.ok(s.campaign.investigators[1].deck.includes('07083'));assert.equal(Object.values(s.campaign.investigators).flatMap(i=>i.deck).filter(c=>c==='07083').length,1)
})
test('P7 interlude IV independently applies both passages and preserves the prior Harper owner choice',()=>{
 const s=fixture('01001',2);delete s.campaign.flow;Object.assign(s.campaign.records,{TheTerrorOfDevilReefIsDead:true,TheGatekeeperHasBeenDefeated:true,memoriesRecovered:['TheLifecycleOfADeepOne']})
 s.campaign.investigators[0].deck.push('07082','07179');s.campaign.investigators[1].deck.push('07083')
 run(s,'interlude4',c=>{assert.equal(c.seat,1);return 'keep'})
 assert.ok(s.campaign.records.TheGuardianOfYhanthleiIsDispatched);assert.ok(s.campaign.records.TheGatewayToYhanthleiRecognizesYouAsTheRightfulKeeper)
 assert.equal(s.campaign.investigators[0].deck.includes('07082'),false);assert.equal(s.campaign.investigators[0].deck.includes('07083'),false);assert.equal(s.campaign.investigators[1].deck.includes('07083'),true)
})
for(const complete of [false,true])test(`P7 epilogue ${complete?'all fourteen memories recover the printed horrible truth':'an incomplete set reads the alternate ending'}`,()=>{
 const s=fixture();delete s.campaign.flow;s.campaign.records.memoriesRecovered=complete?[...all]:all.slice(0,-1);run(s,'epilogue')
 assert.equal(!!s.campaign.records.TheHorribleTruth,complete);
 // 参考实现把「可怕的真相」写成战役**记录**，不是记忆：14 段记忆列表不得被第 15 个 id 污染（审计 M42）。
 assert.equal(s.campaign.records.memoriesRecovered.includes('TheHorribleTruth'),false)
 assert.equal(s.campaign.records.memoriesRecovered.length,complete?all.length:all.length-1)
})
