import './tic-chapter-fixture.mjs'
// Draft integration cases; worker does not run behavior tests. Main reviews and executes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture as coreFixture, move, settle, enemy, asset } from '../tests/core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { legalMoves, validateMove, revealLocation, drawEncounter, reactionWindow, enemyAttack, enemyHealth, enemyFightValue, enemyEvadeValue, getStat, scenarioRuntime, discoverClueAt, executeDescriptor, checkAct, getMaxSanity } from '../src/engine/engine.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'

const readyCards = {thePitOfDespair:['07042','07043','07044','07046','07047','07048','07049','07050','07051','07052'],theVanishingOfElinaHarper:['07062b','07063','07064','07065','07066','07067','07068','07069','07070','07071','07072','07073','07075','07076','07077','07079','07080','07081','07082','07083'],inTooDeep:['07128','07129','07130','07131','07132','07133','07134','07135','07136','07137','07138','07139','07140','07142','07143','07145','07146','07147','07149','07150','07151']}
for (const [scenario,codes] of Object.entries(readyCards)) for (const code of codes) {
  if (!registeredEntry(code)) registerCardAbilities((await import(`../src/cards/encounter-entries/theInnsmouthConspiracy/${scenario}/${code}.js`)).default)
}
if(!registeredEntry('07020'))registerCardAbilities((await import('../src/cards/entries/07020.js')).default)
registerCardAbilities({code:'testTicP7NoDraw',modifiers:[{target:'capability:draw',amount:1}]})
registerCardAbilities({code:'testTicP7ReturnJoe',abilities:[{kind:'action',cost:{action:false},resolve:({inv,api,context})=>api.returnAssetToHand(inv.seat,inv.assets.find(a=>a.id===context.assetId))}]})
registerCardAbilities({code:'testTicEarlyEmergingObserver',abilities:[{
 kind:'forced',trigger:'enemySpawn',limit:{scope:'perWindow',owner:'instance'},
 criteria:({context})=>context.enemy?.originalCode==='07146'||context.enemy?.code==='07146',
 resolve:({inv,context,api})=>{
  assert.equal(context.enemy.exhausted,api.water.level(context.enemy.location)<2,'actual draw must apply options before spawn window')
  assert.equal(context.enemy.engagedSeat,null)
  api.gainResources(inv.seat,1)
 },
}]})
registerCardAbilities({code:'testTicEarlySuspectDefeatObserver',abilities:[{
 kind:'forced',trigger:'enemyDefeated',limit:{scope:'perWindow',owner:'instance'},
 criteria:({context})=>['07076','07077','07079','07080','07081'].includes(context.enemy?.originalCode||context.enemy?.code),
 resolve:({inv,api})=>api.gainResources(inv.seat,100),
}]})
function fixture(code, count=1) {
  const s=coreFixture('01001',count);s.humanSeats=s.investigators.map(i=>i.seat);s.abilityLimits={}
  s.locations=[{id:code,code,originalCode:code,name:code,revealed:true,connections:['remote'],clues:1,maxClues:1,shroud:2},
    {id:'remote',code:'remote',name:'remote',revealed:true,connections:[code],clues:0,maxClues:0,shroud:0}]
  for(const inv of s.investigators)inv.location=code
  return s
}
function run(s,fn,select=()=>null) {
 const exec=d=>fn(d);resolveTransaction(s,0,{action:'ticP7EarlyDraft'},exec)
 for(let n=0;s.pendingChoice;n++) {
  assert.ok(n<150,JSON.stringify(s.pendingChoice));const c=s.pendingChoice
  const id=select(c,s)??['done','skip','self'].find(id=>c.options.some(o=>o.id===id))??c.options[0].id
  const answer={action:'choose',choiceId:c.id,optionId:id};assert.equal(choiceError(s,c.seat,answer),null)
  resolveTransaction(s,c.seat,answer,exec)
 }
}
const ability=(s,code)=>legalMoves(s).find(m=>m.action==='entityAbility'&&m.entityId===code)
const blockedEdge=(s,count=2)=>createMechanicsApi(s).barriers.set(s.investigators[0].location,'remote',count)

// Test-only story bridge verifies the card-owned prerequisites, selected actor,
// flashback identity and group limit. Actual chapter rewards stay readerPending.
const earlyFlashbackId='testTicEarlyFlashbacks'
const earlyFlashbackCampaign=structuredClone(contentRegistry.getCampaign('nightOfTheZealot'))
Object.assign(earlyFlashbackCampaign,{id:earlyFlashbackId,scenarioIds:[earlyFlashbackId],status:'development',unlock:{[earlyFlashbackId]:[]}})
delete earlyFlashbackCampaign.flow
const earlyFlashbackScenario=structuredClone(contentRegistry.getScenarioData('theGathering'))
Object.assign(earlyFlashbackScenario,{id:earlyFlashbackId,campaignId:earlyFlashbackId})
const earlyFlashbackManifest=structuredClone(contentRegistry.getScenario('theGathering'))
Object.assign(earlyFlashbackManifest,{id:earlyFlashbackId,campaignId:earlyFlashbackId,status:'development',behaviorIds:[earlyFlashbackId]})
registerContentBundle({campaigns:[earlyFlashbackCampaign],scenarios:[{scenario:earlyFlashbackScenario,manifest:earlyFlashbackManifest,
 behavior:{id:earlyFlashbackId,resolveFlashback(state,seat,id,api){
  api.setScenarioFlag('earlyFlashbackCalls',[...(state.scenarioFlags.earlyFlashbackCalls||[]),{seat,id}])
 },cluesGained(state,inv,amount,api){api.setScenarioFlag('earlyClueHooks',[...(state.scenarioFlags.earlyClueHooks||[]),{seat:inv.seat,amount}])} } }]})
const flashbackMove=(s,code,index)=>legalMoves(s).find(m=>m.action==='entityAbility'&&m.entityId===code&&m.abilityIndex===index)
for(const [code,index,key,count,id] of [
 ['07048',0,'yellow',null,'flashback2'],['07049',0,'red',null,'flashback3'],['07051',0,'purple',null,'flashback4'],
 ['07130',1,null,7,'flashback7'],['07133',1,'black',null,'flashback8'],['07135',1,null,5,'flashback6'],['07139',1,null,2,'flashback5'],
])test(`P7 ${code} actual flashback activation checks actor/group keys and shared limit across JSON`,()=>{
 const s=fixture(code,2),a=createMechanicsApi(s),personal=!!key,cleared=code.startsWith('070')
 s.scenario.id=earlyFlashbackId;s.locations[0].clues=cleared?0:2
 const colors=personal?[key]:['red','yellow','green','blue','purple','white','black'].slice(0,count)
 a.keys.initialize(colors.map(color=>({color,holder:'investigator:1',revealed:true})))
 if(personal) {
  assert.equal(flashbackMove(s,code,index),undefined,'other investigator key never qualifies actor')
  a.keys.transfer(key,'investigator:1','investigator:0')
 } else {
  s.investigators[1].location='remote'
  a.keys.transfer(colors.at(-1),'investigator:1','location:remote')
  assert.equal(flashbackMove(s,code,index),undefined,'ground key does not count as group-controlled')
  a.keys.transfer(colors.at(-1),'location:remote','investigator:1')
 }
 if(cleared) {
  s.locations[0].clues=1;assert.equal(flashbackMove(s,code,index),undefined)
  s.locations[0].clues=0
 }
 const actions=s.investigators[0].actionsLeft;move(s,flashbackMove(s,code,index));settle(s)
 assert.deepEqual(s.scenarioFlags.earlyFlashbackCalls,[{seat:0,id}]);assert.equal(s.investigators[0].actionsLeft,actions)
 const saved=JSON.parse(JSON.stringify(s));saved.currentSeat=1;saved.investigators[1].location=code
 if(personal)createMechanicsApi(saved).keys.transfer(key,'investigator:0','investigator:1')
 assert.equal(flashbackMove(saved,code,index),undefined,'second investigator cannot repeat shared once/game after JSON')
})
test('P7 07048 shroud counts all local investigator keys and excludes ground and remote keys',()=>{
 const s=fixture('07048',3),a=createMechanicsApi(s);s.locations[0].shroud=6;s.investigators[0].intellect=10;s.investigators[2].location='remote'
 a.keys.initialize([{color:'yellow',holder:'investigator:0',revealed:true},{color:'red',holder:'investigator:1',revealed:true},
  {color:'blue',holder:'investigator:2',revealed:true},{color:'purple',holder:'location:07048',revealed:true}])
 move(s,{action:'investigate'});settle(s);assert.equal(s.lastTestResult.difficulty,4)
 a.keys.transfer('red','investigator:1','investigator:2');s.locations[0].clues=1
 move(s,{action:'investigate'});settle(s);assert.equal(s.lastTestResult.difficulty,5)
})
test('P7 07049 actual end-turn horror checks the ending investigator own keys and actual location',()=>{
 for(const reason of ['none','own-key','elsewhere']) {
  const s=fixture('07049',2),a=createMechanicsApi(s)
  a.keys.initialize([{color:'red',holder:reason==='own-key'?'investigator:0':'investigator:1',revealed:true}])
  if(reason==='elsewhere')s.investigators[0].location='remote'
  const horror=s.investigators[0].horror;move(s,{action:'endTurn'});settle(s)
  assert.equal(s.investigators[0].horror,horror+(reason==='none'?1:0))
 }
})
test('P7 07051 real reveal places only the set-aside blue key and cannot steal or duplicate a claimed key',()=>{
 const s=fixture('07051'),a=createMechanicsApi(s);s.locations[0].revealed=false
 a.keys.initialize([{color:'blue',holder:'setAside',revealed:true}])
 run(s,d=>revealLocation(d,'07051',[],0));assert.deepEqual(a.keys.at('location:07051'),['blue'])
 a.keys.transfer('blue','location:07051','investigator:0')
 const saved=JSON.parse(JSON.stringify(s));saved.locations[0].revealed=false
 run(saved,d=>revealLocation(d,'07051',[],0))
 assert.deepEqual(createMechanicsApi(saved).keys.at('investigator:0'),['blue'])
 assert.deepEqual(createMechanicsApi(saved).keys.at('location:07051'),[])
})
test('P7 07130 one-action willpower test uses initial player count and removes barrier only on success',()=>{
 for(const success of [true,false]) {
  const s=fixture('07130',2),a=createMechanicsApi(s);blockedEdge(s);s.investigators[0].willpower=4;s.chaosBag=[success?'0':'autofail']
  const actions=s.investigators[0].actionsLeft;move(s,ability(s,'07130'));settle(s)
  assert.equal(s.lastTestResult.skill,'willpower');assert.equal(s.lastTestResult.difficulty,2)
  assert.equal(a.barriers.count('07130','remote'),success?1:2);assert.equal(s.investigators[0].actionsLeft,actions-1)
 }
})
test('P7 07135 two-action encounter cost draws real enemy before barrier removal and empty piles reject atomically',()=>{
 const s=fixture('07135'),a=createMechanicsApi(s);blockedEdge(s);s.encounterDeck=['ghoulMinion'];s.encounterDiscard=[]
 const actions=s.investigators[0].actionsLeft;move(s,ability(s,'07135'));settle(s)
 assert.equal(s.enemies.length,1);assert.equal(s.enemies[0].engagedSeat,0)
 assert.equal(a.barriers.count('07135','remote'),1);assert.equal(s.investigators[0].actionsLeft,actions-2)
 const t=fixture('07135');blockedEdge(t);t.encounterDeck=[];t.encounterDiscard=[]
 const before=JSON.stringify(t);assert.equal(ability(t,'07135'),undefined);assert.equal(JSON.stringify(t),before)
})
test('P7 07135 lethal revelation paid as a cost stops before any barrier benefit',()=>{
 const s=fixture('07135',2);blockedEdge(s);s.investigators[0].horror=getMaxSanity(s.investigators[0])-1
 s.encounterDeck=['rottingRemains'];s.encounterDiscard=[];s.chaosBag=['autofail']
 move(s,ability(s,'07135'));settle(s)
 assert.equal(s.investigators[0].defeated,true);assert.equal(createMechanicsApi(s).barriers.count('07135','remote'),2)
})
test('P7 07139 actual reveal consumes physical set-aside Shoggoth once and spawns it already exhausted',()=>{
 const s=fixture('07139');s.locations[0].revealed=false;s.scenarioZones={...(s.scenarioZones||{}),setAside:['07144']}
 run(s,d=>revealLocation(d,'07139',[],0))
 assert.equal(s.enemies.filter(e=>e.originalCode==='07144'||e.code==='07144').length,1)
 assert.equal(s.enemies[0].exhausted,true);assert.equal(s.enemies[0].engagedSeat,null);assert.deepEqual(s.scenarioZones.setAside,[])
 const saved=JSON.parse(JSON.stringify(s));saved.locations[0].revealed=false
 run(saved,d=>revealLocation(d,'07139',[],0));assert.equal(saved.enemies.length,1)
})
test('P7 07139 moves a physical barrier to a different edge through a real pending choice and JSON',()=>{
 const s=fixture('07139'),a=createMechanicsApi(s);blockedEdge(s)
 for(const id of ['squareDest1','squareDest2'])s.locations.push({id,code:'plain',name:id,revealed:true,connections:['07139'],clues:0})
 s.locations[0].connections.push('squareDest1','squareDest2')
 move(s,ability(s,'07139'));assert.ok(s.pendingChoice)
 const saved=JSON.parse(JSON.stringify(s));settle(s,c=>c.options.some(o=>o.id==='squareDest2')?'squareDest2':null)
 settle(saved,c=>c.options.some(o=>o.id==='squareDest2')?'squareDest2':null)
 assert.equal(a.barriers.count('07139','remote'),1);assert.equal(a.barriers.count('07139','squareDest2'),1)
 assert.deepEqual(saved.scenarioFlags.mechanics,s.scenarioFlags.mechanics)
 const t=fixture('07139');blockedEdge(t);assert.equal(ability(t,'07139'),undefined,'no different connection means no movable barrier')
})
test('P7 07146 actual encounter draw applies exhaustion before spawn listeners and full-flood engagement attacks',()=>{
 for(const level of [0,1,2]) {
  const s=fixture('earlyEmerging'),a=createMechanicsApi(s);a.water.set('earlyEmerging',level);asset(s,'testTicEarlyEmergingObserver')
  s.encounterDeck=['07146'];s.encounterDiscard=[];const resources=s.investigators[0].resources
  const saved=JSON.parse(JSON.stringify(s));for(const state of [s,saved])run(state,d=>drawEncounter(d,d.investigators[0],[]))
  const e=s.enemies.find(e=>e.originalCode==='07146'||e.code==='07146');assert.ok(e)
  assert.equal(e.exhausted,level<2);assert.equal(e.engagedSeat,level<2?null:0)
  assert.equal(s.investigators[0].damage,level===2?e.damage:0)
  assert.equal(s.investigators[0].horror,level===2?e.horror:0)
  assert.equal(s.investigators[0].resources,resources+1)
  assert.deepEqual(saved.enemies,s.enemies);assert.deepEqual(saved.investigators[0],s.investigators[0])
 }
})
test('P7 07146 engaging an already exhausted copy still attacks when flooded, while dry engagement is safe',()=>{
 for(const level of [0,1]) {
  const s=fixture('earlyEmerging'),a=createMechanicsApi(s);a.water.set('earlyEmerging',level)
  const e=enemy(s,{code:'07146',originalCode:'07146',engagedSeat:null,exhausted:true,damage:1,horror:1})
  move(s,{action:'engage',enemyId:e.id});settle(s)
  assert.equal(s.investigators[0].damage,level?1:0);assert.equal(s.investigators[0].horror,level?1:0)
 }
})

for(const [code,homes,skill] of [
 ['07076',['07066','07138'],'agility'],['07077',['07068','07136'],'agility'],
 ['07079',['07063','07141'],'willpower'],['07080',['07069','07135'],'willpower'],['07081',['07064','07140'],null],
])test(`P7 ${code} actual Revelation uses both chapter homes; successful parleys transfer clues and banish Victory0 without defeat`,()=>{
 for(const home of homes) {
  const s=fixture('earlySuspectHome',2),a=createMechanicsApi(s);s.scenario.id=earlyFlashbackId
  Object.assign(s.locations[1],{code:home,originalCode:home,name:'Physical Home'})
  asset(s,'testTicEarlySuspectDefeatObserver')
  s.encounterDeck=[code];s.encounterDiscard=[]
  run(s,d=>drawEncounter(d,d.investigators[1],[]))
  const e=s.enemies.find(e=>(e.originalCode||e.code)===code);assert.ok(e);assert.equal(e.location,'remote');assert.equal(e.clues,2)
  assert.equal(legalMoves(s).some(m=>m.action==='entityAbility'&&m.entityId===e.id),false,'remote suspect cannot be parleyed')
  move(s,{action:'move',locationId:'remote'});settle(s)
  if(skill)s.investigators[0][skill]=10
  const resources=s.investigators[0].resources,clues=s.investigators[0].clues
  const parley=()=>legalMoves(s).find(m=>m.action==='entityAbility'&&m.entityId===e.id)
  move(s,parley());settle(s)
  assert.equal(s.enemies.find(x=>x.id===e.id).clues,1);assert.equal(s.investigators[0].clues,clues+1)
  const saved=JSON.parse(JSON.stringify(s));move(saved,legalMoves(saved).find(m=>m.action==='entityAbility'&&m.entityId===e.id));settle(saved)
  assert.equal(saved.enemies.some(x=>x.id===e.id),false)
  assert.equal(saved.victoryDisplay.filter(v=>v.id===e.id).length,1)
  assert.equal(saved.victoryDisplay.find(v=>v.id===e.id).victory,0)
  assert.equal(saved.investigators[0].clues,clues+2)
  assert.equal(saved.investigators[0].resources,resources-(code==='07081'?6:0),'parley banish must not open enemyDefeated reward')
  assert.deepEqual(saved.scenarioFlags.earlyClueHooks,[{seat:0,amount:1},{seat:0,amount:1}])
 }
})
for(const [code,skill,difficulty,damage,horror] of [
 ['07076','agility',2,1,0],['07077','agility',3,0,0],['07079','willpower',2,0,1],['07080','willpower',3,0,0],
])test(`P7 ${code} failed real parley keeps clues and applies only its printed failure penalty`,()=>{
 const s=fixture('earlySuspect'),e=enemy(s,{code,originalCode:code,engagedSeat:null,aloof:true,clues:1});s.chaosBag=['autofail']
 move(s,legalMoves(s).find(m=>m.action==='entityAbility'&&m.entityId===e.id));settle(s)
 assert.equal(s.lastTestResult.skill,skill);assert.equal(s.lastTestResult.difficulty,difficulty)
 assert.equal(s.investigators[0].damage,damage);assert.equal(s.investigators[0].horror,horror)
 assert.equal(s.enemies.find(x=>x.id===e.id).clues,1);assert.equal(s.investigators[0].clues,0)
 assert.equal(s.victoryDisplay.some(v=>v.id===e.id),false)
})
test('P7 07081 insufficient three-resource parley rejects before action or clue mutation',()=>{
 const s=fixture('earlySuspect'),e=enemy(s,{code:'07081',originalCode:'07081',engagedSeat:null,aloof:true,clues:1});s.investigators[0].resources=2
 const before=JSON.stringify(s)
 assert.equal(legalMoves(s).some(m=>m.action==='entityAbility'&&m.entityId===e.id),false)
 assert.notEqual(validateMove(s,0,{action:'entityAbility',entityId:e.id,abilityIndex:0}),null)
 assert.equal(JSON.stringify(s),before)
})
test('P7 07075 actual peek discards non-Victory top to true encounter discard and retains printed Victory0',()=>{
 for(const code of ['dissonantVoices','07076']) {
  const s=fixture('07075',2),a=createMechanicsApi(s);s.locations[0].clues=0;s.encounterDiscard=[]
  a.scenarioDecks.initialize('leads',[code],{shuffle:false})
  const actions=s.investigators[0].actionsLeft;move(s,ability(s,'07075'));assert.ok(s.pendingChoice)
  const saved=JSON.parse(JSON.stringify(s));settle(s);settle(saved)
  assert.equal(s.investigators[0].actionsLeft,actions-2)
  assert.equal(a.scenarioDecks.size('leads'),code==='07076'?1:0)
  assert.deepEqual(s.encounterDiscard,code==='07076'?[]:[code])
  saved.currentSeat=1;assert.equal(ability(saved,'07075'),undefined,'group once/game survives JSON and other player')
  assert.deepEqual(saved.scenarioFlags.mechanics,s.scenarioFlags.mechanics)
 }
 const t=fixture('07075');createMechanicsApi(t).scenarioDecks.initialize('leads',['dissonantVoices'],{shuffle:false})
 assert.equal(ability(t,'07075'),undefined,'positive clues reject activation')
})
function labyrinthBoard() {
 const s=fixture('earlyLabyrinth',2);s.acts=[{id:'act07128',code:'07128',originalCode:'07128',stage:1,name:'Through the Labyrinth'}];s.actIndex=0
 s.investigators[1].location='remote';s.investigators[0].clues=1;s.investigators[1].clues=2;blockedEdge(s)
 return s
}
test('P7 07128 real act free ability charges global group clues and removes actor-local barrier without actions',()=>{
 const s=labyrinthBoard(),a=createMechanicsApi(s),actions=s.investigators[0].actionsLeft
 enemy(s,{damage:1,horror:1})
 const m=legalMoves(s).find(m=>m.action==='entityAbility'&&m.entityId==='act07128');assert.ok(m,'actual legalMoves must enumerate current act free ability')
 move(s,m);assert.ok(s.pendingChoice,'global cost should ask which eligible investigator contributes')
 const saved=JSON.parse(JSON.stringify(s));settle(s);settle(saved)
 assert.equal(s.investigators[0].clues+s.investigators[1].clues,0)
 assert.equal(a.barriers.count('earlyLabyrinth','remote'),1);assert.equal(s.investigators[0].actionsLeft,actions)
 assert.equal(s.investigators[0].damage,0);assert.equal(s.investigators[0].horror,0)
 assert.deepEqual(saved.scenarioFlags.mechanics,s.scenarioFlags.mechanics)
 assert.deepEqual(saved.investigators.map(inv=>inv.clues),s.investigators.map(inv=>inv.clues))
})
test('P7 07128 insufficient or eliminated remote clue payer and absent barriers reject before payment',()=>{
 for(const reason of ['one-short','eliminated','no-barrier']) {
  const s=labyrinthBoard()
  if(reason==='one-short')s.investigators[1].clues=1
  if(reason==='eliminated'){s.investigators[1].defeated=true;s.investigators[1].clues=99}
  if(reason==='no-barrier')createMechanicsApi(s).barriers.set('earlyLabyrinth','remote',0)
  const before=JSON.stringify(s)
  assert.equal(legalMoves(s).some(m=>m.action==='entityAbility'&&m.entityId==='act07128'),false)
  assert.equal(JSON.stringify(s),before)
 }
})

function pitExpansionBoard(active=true) {
 const s=fixture('earlyPitAnchor'),a=createMechanicsApi(s)
 s.locations[0].revealed=false
 s.acts=[{id:'earlyAct',code:active?'07046':'plain',originalCode:active?'07046':'plain',stage:2,name:'The Escape'},
  {id:'earlyInactiveAct',code:active?'plain':'07046',stage:3,name:'Next'}];s.actIndex=0
 a.map.place('earlyPitAnchor',0,0);a.map.place('remote',-1,0)
 const physical=['earlyTunnelA','earlyTunnelB','earlyTunnelC']
 for(const id of physical)s.scenario.locations[id]={code:'07047',originalCode:'07047',name:'Tidal Tunnel',clues:1,shroud:2,connections:[],hiddenIdentity:true}
 a.scenarioDecks.initialize('tidalTunnels',[...physical].reverse(),{shuffle:false})
 return s
}
test('P7 07046 real reveal expands down/left/right only into empty cells and preserves physical tunnel count',()=>{
 const s=pitExpansionBoard(),before=s.locations.length+createMechanicsApi(s).scenarioDecks.size('tidalTunnels')
 run(s,d=>revealLocation(d,'earlyPitAnchor',[],0))
 const a=createMechanicsApi(s)
 assert.deepEqual(a.map.position('earlyTunnelA'),{x:0,y:-1,isolated:false})
 assert.deepEqual(a.map.position('earlyTunnelB'),{x:1,y:0,isolated:false})
 assert.equal(a.map.position('earlyTunnelC'),null)
 assert.equal(a.scenarioDecks.size('tidalTunnels'),1)
 assert.equal(s.locations.length+a.scenarioDecks.size('tidalTunnels'),before)
 assert.equal(s.locations.find(l=>l.id==='earlyTunnelA').revealed,false)
 const saved=JSON.parse(JSON.stringify(s))
 run(saved,d=>revealLocation(d,'earlyPitAnchor',[],0))
 assert.equal(saved.locations.length,s.locations.length)
 assert.deepEqual(saved.scenarioFlags.mechanics,s.scenarioFlags.mechanics)
})
test('P7 07046 inactive act cannot expand and empty tunnel deck never duplicates physical locations',()=>{
 const inactive=pitExpansionBoard(false),count=inactive.locations.length
 run(inactive,d=>revealLocation(d,'earlyPitAnchor',[],0))
 assert.equal(inactive.locations.length,count);assert.equal(createMechanicsApi(inactive).scenarioDecks.size('tidalTunnels'),3)
 const empty=pitExpansionBoard();createMechanicsApi(empty).scenarioDecks.take('tidalTunnels',3)
 run(empty,d=>revealLocation(d,'earlyPitAnchor',[],0))
 assert.equal(empty.locations.length,count);assert.equal(createMechanicsApi(empty).scenarioDecks.size('tidalTunnels'),0)
})
test('P7 07046 objective uses actual checkAct: one surviving investigator remaining prevents advance',()=>{
 const s=fixture('earlyPitAnchor',2)
 s.acts=[{id:'earlyEscape',code:'07046',originalCode:'07046',stage:2,name:'The Escape'},
  {id:'earlyNext',code:'plain',stage:3,name:'Next',text:''}];s.actIndex=0
 s.investigators[0].resigned=true
 run(s,d=>checkAct(d,[]));assert.equal(s.actIndex,0)
 const saved=JSON.parse(JSON.stringify(s));saved.investigators[1].defeated=true
 run(saved,d=>checkAct(d,[]));assert.equal(saved.actIndex,1)
 s.investigators[1].resigned=true
 run(s,d=>checkAct(d,[]));assert.equal(s.actIndex,1)
 // Back-side finish('resolution1') needs the actual chapter resolution handler;
 // this case intentionally verifies only the registered objective reader.
})

test('P7 07145 fight and evade follow the actual enemy location water level, not a remote investigator',()=>{
 const s=fixture('earlyRavager'),e=enemy(s,{code:'07145',originalCode:'07145',engagedSeat:null,fight:2,evade:3})
 const a=createMechanicsApi(s);s.investigators[0].location='remote';a.water.set('remote',2)
 for(const level of [0,1,2,0]) {
  a.water.set('earlyRavager',level)
  assert.equal(enemyFightValue(s,e),2+level);assert.equal(enemyEvadeValue(s,e),3+level)
 }
})
test('P7 07145 actual engagement combat test adds only west-edge barrier on failure and resumes after JSON',()=>{
 for(const success of [true,false]) {
  const s=fixture('earlyRavager'),a=createMechanicsApi(s)
  a.map.place('earlyRavager',0,0);a.map.place('remote',-1,0)
  s.locations.push({id:'eastDecoy',name:'east',code:'plain',revealed:true,connections:['earlyRavager'],clues:0})
  a.map.place('eastDecoy',1,0)
  const e=enemy(s,{code:'07145',originalCode:'07145',engagedSeat:null,fight:2,evade:3})
  s.chaosBag=[success?'0':'autofail'];s.investigators[0].combat=4
  move(s,{action:'engage',enemyId:e.id})
  const saved=JSON.parse(JSON.stringify(s));settle(s);settle(saved)
  assert.equal(s.lastTestResult.skill,'combat');assert.equal(s.lastTestResult.difficulty,2)
  assert.equal(a.barriers.count('earlyRavager','remote'),success?0:1)
  assert.equal(a.barriers.count('earlyRavager','eastDecoy'),0)
  assert.deepEqual(saved.scenarioFlags.mechanics,s.scenarioFlags.mechanics)
  assert.deepEqual(saved.investigators[0].engaged,s.investigators[0].engaged)
 }
})
test('P7 07145 missing west connection or Coastline prevention cannot create an illegal barrier',()=>{
 for(const protectedWest of [false,true]) {
  const s=fixture('earlyRavager'),a=createMechanicsApi(s)
  a.map.place('earlyRavager',0,0);a.map.place('remote',protectedWest?-1:1,0)
  if(protectedWest)Object.assign(s.locations.find(l=>l.id==='remote'),{code:'07143',originalCode:'07143'})
  const e=enemy(s,{code:'07145',originalCode:'07145',engagedSeat:null});s.chaosBag=['autofail']
  move(s,{action:'engage',enemyId:e.id});settle(s)
  assert.equal(a.barriers.count('earlyRavager','remote'),0)
 }
})
function invasionBoard() {
 const s=fixture('earlyInvasion'),a=createMechanicsApi(s)
 a.map.place('earlyInvasion',0,0);a.map.place('remote',-1,0)
 for(const [id,x,y] of [['east1',1,0],['east2',2,0],['otherRow',1,1]]) {
  s.locations.push({id,name:id,code:'plain',revealed:true,connections:[],clues:0,shroud:0})
  a.map.place(id,x,y)
 }
 return s
}
test('P7 07147 shuffles actual discard and spawns Hunter Deep Ones at each eastern same-row location',()=>{
 const s=invasionBoard()
 s.encounterDeck=['dissonantVoices','07088','07146','07147'];s.encounterDiscard=['07146']
 const before=s.encounterDeck.length+s.encounterDiscard.length
 const saved=JSON.parse(JSON.stringify(s))
 for(const state of [s,saved])run(state,d=>drawEncounter(d,d.investigators[0],[]))
 assert.deepEqual(s.enemies.map(e=>e.location).sort(),['east1','east2'])
 assert.equal(s.enemies.every(e=>e.originalCode==='07146'||e.code==='07146'),true)
 assert.equal(s.enemies.every(e=>!e.exhausted),true,'spawning from discard is not drawing its Revelation')
 assert.equal(s.enemies.some(e=>['earlyInvasion','remote','otherRow'].includes(e.location)),false)
 assert.equal(s.enemies.length+s.encounterDeck.length+s.encounterDiscard.length,before)
 assert.equal(s.encounterDiscard.includes('07147'),true)
 assert.deepEqual(saved.enemies,s.enemies);assert.deepEqual(saved.encounterDeck,s.encounterDeck)
})
test('P7 07147 a finite deck with only non-Hunter Deep Ones cannot spawn them or reshuffle forever',()=>{
 const s=invasionBoard();s.encounterDeck=['07088','dissonantVoices','07147'];s.encounterDiscard=[]
 run(s,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(s.enemies.length,0);assert.equal(s.encounterDeck.length,0)
 assert.deepEqual([...s.encounterDiscard].sort(),['07088','07147','dissonantVoices'].sort())
})

test('P7 random-key Deep locations reveal exactly one hidden key via their own card hooks',()=>{
 for(const code of ['07129','07131','07132','07134','07140']) {
  const s=fixture(code);s.locations[0].revealed=false
  createMechanicsApi(s).keys.initialize([{color:'red',revealed:false},{color:'yellow',revealed:false}])
  run(s,d=>revealLocation(d,code,[],0))
  assert.deepEqual(createMechanicsApi(s).keys.at(`location:${code}`),['unrevealed'])
 }
})
test('P7 07129 two-action intellect parley removes one barrier on success and provokes no attack',()=>{
 for(const success of [true,false]) {
  const s=fixture('07129');blockedEdge(s);s.investigators[0].intellect=4;s.chaosBag=[success?'0':'autofail'];enemy(s,{damage:2})
  const actions=s.investigators[0].actionsLeft;move(s,ability(s,'07129'));settle(s)
  assert.equal(s.investigators[0].actionsLeft,actions-2);assert.equal(s.investigators[0].damage,0)
  assert.equal(createMechanicsApi(s).barriers.count('07129','remote'),success?1:2)
  assert.equal(s.lastTestResult.skill,'intellect');assert.equal(s.lastTestResult.difficulty,3)
 }
})
test('P7 07131 damage cost is assignable to an asset and free parley leaves ordinary actions unchanged',()=>{
 const s=fixture('07131');blockedEdge(s);const dog=asset(s,'01021');const actions=s.investigators[0].actionsLeft
 move(s,ability(s,'07131'));settle(s,c=>c.kind==='assign-damage'?dog.id:null)
 assert.equal(s.investigators[0].damage,0);assert.equal(s.investigators[0].assets.find(a=>a.id===dog.id).damage,1)
 assert.equal(s.investigators[0].actionsLeft,actions);assert.equal(createMechanicsApi(s).barriers.count('07131','remote'),1)
 const t=fixture('07131');assert.equal(ability(t,'07131'),undefined,'no barrier cannot pay damage just to trigger a benefit')
})
test('P7 07132 selected hand discard is paid before free removal and an empty hand cannot activate',()=>{
 const s=fixture('07132');blockedEdge(s);s.investigators[0].hand=['01088','01089'];const actions=s.investigators[0].actionsLeft
 move(s,ability(s,'07132'));settle(s)
 assert.equal(s.investigators[0].hand.length,1);assert.equal(s.investigators[0].discard.length,1)
 assert.equal(s.investigators[0].actionsLeft,actions);assert.equal(createMechanicsApi(s).barriers.count('07132','remote'),1)
 const t=fixture('07132');blockedEdge(t);assert.equal(ability(t,'07132'),undefined)
})
test('P7 07133 resource parley spends three; only the actual black-key holder can trigger FlashbackVIII',()=>{
 const s=fixture('07133',2);blockedEdge(s);const resources=s.investigators[0].resources
 createMechanicsApi(s).keys.initialize([{color:'black',revealed:true,holder:'investigator:1'}])
 assert.equal(legalMoves(s).some(m=>m.entityId==='07133'&&m.abilityIndex===1),false)
 move(s,ability(s,'07133'));settle(s)
 assert.equal(s.investigators[0].resources,resources-3);assert.equal(createMechanicsApi(s).barriers.count('07133','remote'),1)
 createMechanicsApi(s).keys.transfer('black','investigator:1','investigator:0')
 assert.ok(legalMoves(s).some(m=>m.entityId==='07133'&&m.abilityIndex===1))
 const t=fixture('07133');blockedEdge(t);t.investigators[0].resources=2
 assert.equal(ability(t,'07133'),undefined);assert.equal(t.investigators[0].resources,2)
})
test('P7 07134 requires its own clues cleared, then spends one action to remove one barrier',()=>{
 const s=fixture('07134');blockedEdge(s);assert.equal(ability(s,'07134'),undefined)
 s.locations[0].clues=0;const actions=s.investigators[0].actionsLeft
 move(s,ability(s,'07134'));settle(s)
 assert.equal(createMechanicsApi(s).barriers.count('07134','remote'),1);assert.equal(s.investigators[0].actionsLeft,actions-1)
})
test('P7 07136 shroud counts physical barrier tokens and exact curse fee rejects insufficient supply',()=>{
 const s=fixture('07136');s.locations[0].shroud=1;s.locations[0].clues=3;s.investigators[0].intellect=10;blockedEdge(s,3)
 move(s,{action:'investigate'});settle(s);assert.equal(s.lastTestResult.difficulty,4)
 move(s,ability(s,'07136'));settle(s)
 assert.equal(s.chaosBag.filter(t=>t==='curse').length,2);assert.equal(createMechanicsApi(s).barriers.count('07136','remote'),2)
 s.chaosBag=['0'];move(s,{action:'investigate'});settle(s);assert.equal(s.lastTestResult.difficulty,3)
 const t=fixture('07136');blockedEdge(t);t.chaosBag=['0',...Array(9).fill('curse')]
 assert.equal(ability(t,'07136'),undefined);assert.equal(t.chaosBag.filter(x=>x==='curse').length,9)
})
test('P7 07137 actual entry adds a barrier behind; parley chooses lowest modified skill including ties',()=>{
 for(const modified of [false,true]) {
  const s=fixture('07137');s.investigators[0].location='remote'
  Object.assign(s.investigators[0],{willpower:2,intellect:2,combat:3,agility:4});if(modified)asset(s,'07083')
  move(s,{action:'move',locationId:'07137'});settle(s)
  assert.equal(createMechanicsApi(s).barriers.count('07137','remote'),1)
  move(s,ability(s,'07137'));settle(s,c=>c.source==='07137'&&c.kind==='skill'?'intellect':null)
  assert.equal(s.lastTestResult.skill,modified?'willpower':'intellect')
  assert.equal(createMechanicsApi(s).barriers.count('07137','remote'),0)
 }
 const t=fixture('07137');t.investigators[0].location='remote';t.locations[0].connections=[];t.locations[1].connections=[]
 run(t,d=>scenarioRuntime(d,[]).moveInvestigator(0,'07137'))
 assert.equal(t.investigators[0].location,'07137')
 assert.equal(createMechanicsApi(t).barriers.count('07137','remote'),0,'nonconnecting arrival cannot create an edge barrier')
})
test('P7 07138 optional arrival move uses actual printed House identity and respects blocked entry',()=>{
 for(const blocked of [false,true]) {
  const s=fixture('07138');s.investigators[0].location='remote';s.locations[0].connections.push('house-runtime')
  s.locations.push({id:'house-runtime',code:'07132',originalCode:'07132',name:'House',revealed:true,clues:0,shroud:2,connections:['07138']})
  if(blocked)createMechanicsApi(s).barriers.set('07138','house-runtime',1)
  const actions=s.investigators[0].actionsLeft
  move(s,{action:'move',locationId:'07138'});settle(s,c=>c.options.find(o=>o.id.startsWith('entity:')&&o.cardCode==='07138')?.id)
  assert.equal(s.investigators[0].location,blocked?'07138':'house-runtime');assert.equal(s.investigators[0].actionsLeft,actions-1)
 }
})
test('P7 07140 combat/agility choice conducts the chosen real test and removes a barrier only on success',()=>{
 for(const [skill,success] of [['combat',true],['agility',true],['combat',false]]) {
  const s=fixture('07140');blockedEdge(s);s.investigators[0][skill]=3
  if(!success)s.chaosBag=['autofail']
  move(s,ability(s,'07140'));settle(s,c=>c.source==='07140'&&c.kind==='skill'?skill:null)
  assert.equal(s.lastTestResult.skill,skill);assert.equal(s.lastTestResult.difficulty,2)
  assert.equal(createMechanicsApi(s).barriers.count('07140','remote'),success?1:2)
 }
})
test('P7 07151 three campaign options preserve sealed curses, dry only nonSanctum, and defeat only eligible nonElite',()=>{
 const s=fixture('07143');const book=asset(s,'07151');const api=createMechanicsApi(s)
 s.chaosBag=['0','curse','curse'];api.chaosTokens.seal(book.id,'curse',1)
 api.water.set('07143',2);api.water.set('remote',2);s.locations[1].traits=['Sanctum']
 const e=enemy(s,{engagedSeat:null});const elite=enemy(s,{engagedSeat:null,elite:true})
 const use=(state,id)=>{move(state,legalMoves(state).find(m=>m.assetId===book.id));settle(state,c=>c.source==='07151'&&c.kind==='effect'?id:null)}
 use(s,'Teachings1');assert.equal(s.chaosBag.includes('curse'),false);assert.equal(s.chaos.sealed.filter(t=>t.token==='curse').length,1)
 s.investigators[0].assets.find(a=>a.id===book.id).exhausted=false
 use(s,'Teachings2');assert.equal(createMechanicsApi(s).water.level('07143'),0);assert.equal(createMechanicsApi(s).water.level('remote'),2)
 const saved=JSON.parse(JSON.stringify(s));saved.investigators[0].assets.find(a=>a.id===book.id).exhausted=false
 use(saved,'Teachings3');assert.equal(saved.enemies.some(x=>x.id===e.id),false);assert.equal(saved.enemies.some(x=>x.id===elite.id),true)
 assert.deepEqual(saved.campaign.records.teachingsChoices,['Teachings1','Teachings2','Teachings3'])
 saved.investigators[0].assets.find(a=>a.id===book.id).exhausted=false
 assert.equal(legalMoves(saved).some(m=>m.assetId===book.id),false)
 const t=fixture('07143');const locked=asset(t,'07151');t.campaign.records.teachingsChoices=['Teachings1','Teachings2'];enemy(t,{cannotBeDefeated:true})
 assert.equal(legalMoves(t).some(m=>m.assetId===locked.id),false,'immune nonElite is not a payable option')
})

test('P7 07042 raises revealed locations and future actual reveal exactly once across save',()=>{
 const s=fixture('07047');s.locations[1].revealed=false
 createMechanicsApi(s).water.set('07047',1)
 run(s,d=>registeredEntry('07042').agendaRule.onReveal(d,{code:'07042'},scenarioRuntime(d,[])))
 assert.equal(createMechanicsApi(s).water.level('07047'),2)
 assert.equal(createMechanicsApi(s).water.level('remote'),0)
 const saved=JSON.parse(JSON.stringify(s))
 for(const state of [s,saved])run(state,d=>revealLocation(d,'remote',[],0))
 assert.equal(createMechanicsApi(s).water.level('remote'),1)
 assert.deepEqual(s.scenarioFlags.mechanics,saved.scenarioFlags.mechanics)
 run(s,d=>revealLocation(d,'remote',[],0));assert.equal(createMechanicsApi(s).water.level('remote'),1)
})
test('P7 07043 replaces previous increase reminder and makes current/future revealed locations fully flooded',()=>{
 const s=fixture('07047');s.locations[1].revealed=false
 createMechanicsApi(s).water.setRevealPolicy({mode:'increase',amount:1})
 run(s,d=>registeredEntry('07043').agendaRule.onReveal(d,{code:'07043'},scenarioRuntime(d,[])))
 assert.equal(createMechanicsApi(s).water.level('07047'),2)
 assert.equal(createMechanicsApi(s).water.level('remote'),0)
 const saved=JSON.parse(JSON.stringify(s));run(saved,d=>revealLocation(d,'remote',[],0))
 assert.equal(createMechanicsApi(saved).water.level('remote'),2)
 assert.deepEqual(saved.scenarioFlags.mechanics.floodPolicy.reveal,{mode:'set',amount:2})
})
test('P7 07082 draws for a local attacked investigator even when attack was canceled and owner cannot draw',()=>{
 for(const cancel of [false,true]) {
  const s=fixture('07065',2);const dawson=asset(s,'07082');asset(s,'testTicP7NoDraw')
  const e=enemy(s,{engagedSeat:1,damage:1});if(cancel)s.investigators[1].hand=['07020']
  run(s,d=>enemyAttack(d,d.enemies.find(x=>x.id===e.id),d.investigators[1],[],'Dawson test'),c=>
   c.options.find(o=>o.cardCode==='07020')?.id??c.options.find(o=>o.id.startsWith('desc:'))?.id??null)
  assert.equal(s.investigators[1].damage,cancel?0:1);assert.equal(s.investigators[1].hand.length,1)
  assert.equal(s.investigators[0].hand.length,0);assert.equal(s.investigators[0].assets.find(a=>a.id===dawson.id).exhausted,true)
 }
 const s=fixture('07065',2),dawson=asset(s,'07082');asset(s,'testTicP7NoDraw',{},1)
 const e=enemy(s,{engagedSeat:1});run(s,d=>enemyAttack(d,d.enemies.find(x=>x.id===e.id),d.investigators[1],[],'blocked draw'))
 assert.equal(s.investigators[0].assets.find(a=>a.id===dawson.id).exhausted,false)
 assert.equal(s.investigators[1].hand.length,0,'draw prohibition belongs to actual recipient')
})
test('P7 07070–07073 real revelation finds actual template identity and never clones unique locations',()=>{
 for(const code of ['07070','07071','07072','07073']) {
  const s=fixture('start'),id=`location${code}`
  s.scenario={...s.scenario,locations:{...s.scenario.locations,[id]:{id,code,originalCode:code,name:code,shroud:2,cluesPerInvestigator:1,connections:[],traits:['Innsmouth','Hideout']}}}
  s.encounterDeck=[code];run(s,d=>drawEncounter(d,d.investigators[0],[]))
  const loc=s.locations.find(l=>l.originalCode===code);assert.ok(loc);assert.equal(loc.id,id);assert.equal(loc.revealed,true);assert.equal(loc.clues,1)
  const saved=JSON.parse(JSON.stringify(s));saved.encounterDeck=[code];run(saved,d=>drawEncounter(d,d.investigators[0],[]))
  assert.equal(saved.locations.filter(l=>l.originalCode===code).length,1)
 }
})
test('P7 07072 each failed investigation adds one doom and reduces real subsequent shroud by two',()=>{
 const s=fixture('07072');s.locations[0].shroud=5;s.locations[0].clues=3;s.chaosBag=['autofail']
 move(s,{action:'investigate'});settle(s);assert.equal(s.locations[0].doom,1);assert.equal(s.lastTestResult.difficulty,5)
 move(s,{action:'investigate'});settle(s);assert.equal(s.locations[0].doom,2);assert.equal(s.lastTestResult.difficulty,3)
 s.chaosBag=['0'];s.investigators[0].intellect=10;move(s,{action:'investigate'});settle(s)
 assert.equal(s.lastTestResult.difficulty,1);assert.equal(s.locations[0].doom,2,'success never adds doom')
})
test('P7 07073 success by three selects actual encounter draw or unseen top-card shuffle',()=>{
 for(const mode of ['draw','shuffle']) {
  const s=fixture('07073');s.investigators[0].intellect=5;s.locations[0].clues=2
  createMechanicsApi(s).scenarioDecks.initialize('leads',['07076'],{shuffle:false});s.encounterDeck=['dissonantVoices','ghoulMinion']
  move(s,{action:'investigate'});settle(s,c=>c.source==='07073'?mode:null)
  assert.deepEqual(s.encounterDeck,['dissonantVoices'])
  assert.equal(s.enemies.length,mode==='draw'?1:0)
  assert.equal(createMechanicsApi(s).scenarioDecks.size('leads'),mode==='shuffle'?2:1)
 }
})
test('P7 07073 borrowed investigation resolves the actual investigator rather than current turn seat',()=>{
 const s=fixture('07073',2);s.investigators[1].intellect=5;s.locations[0].clues=2
 createMechanicsApi(s).scenarioDecks.initialize('leads',[],{shuffle:false});s.encounterDeck=['ghoulMinion']
 let chooser=null
 run(s,d=>scenarioRuntime(d,[]).investigate(1),c=>{if(c.source==='07073'){chooser=c.seat;return 'draw'}return null})
 assert.equal(chooser,1);assert.equal(s.enemies.length,1);assert.equal(s.enemies[0].engagedSeat,1)
})
test('P7 07066 only investigation success by at least three peeks and shuffles without drawing',()=>{
 const s=fixture('07066');createMechanicsApi(s).scenarioDecks.initialize('leads',['07076','07077'],{shuffle:false})
 s.locations[0].clues=3;s.investigators[0].intellect=4
 move(s,{action:'investigate'});settle(s);assert.equal(createMechanicsApi(s).scenarioDecks.size('leads'),2)
 s.investigators[0].intellect=5;const saved=JSON.parse(JSON.stringify(s))
 for(const state of [s,saved]){move(state,{action:'investigate'});settle(state)}
 assert.equal(s.enemies.length,0,'looking at a Suspect does not draw or spawn it')
 assert.equal(createMechanicsApi(s).scenarioDecks.size('leads'),2)
 assert.deepEqual(s.scenarioFlags.mechanics,saved.scenarioFlags.mechanics)
 let peeks=0;move(s,{action:'investigate'});settle(s,c=>{if(c.source==='leads')peeks++;return null})
 assert.equal(peeks,0,'group round limit prevents another peek')
})
test('P7 07070 actual final-clue discovery removes one hidden lead; earlier discovery does not',()=>{
 const s=fixture('07070');s.locations[0].clues=2
 createMechanicsApi(s).scenarioDecks.initialize('leads',['07076','07077'],{shuffle:false})
 run(s,d=>discoverClueAt(d,d.investigators[0],1,[]))
 assert.equal(createMechanicsApi(s).scenarioDecks.size('leads'),2)
 run(s,d=>discoverClueAt(d,d.investigators[0],1,[]))
 assert.equal(createMechanicsApi(s).scenarioDecks.size('leads'),1)
 assert.deepEqual(s.scenarioFlags.mechanics.scenarioDecks.leads.removed,['07077'])
 assert.equal(s.enemies.length,0)
})
test('P7 07071 aura applies only to local Humanoids and disappears on moving away',()=>{
 const s=fixture('07071'),a=enemy(s,{traits:['Humanoid'],fight:3,evade:3})
 const b=enemy(s,{traits:['Monster'],fight:3,evade:3,engagedSeat:null})
 assert.equal(enemyFightValue(s,a,s.investigators[0]),5);assert.equal(enemyEvadeValue(s,a,s.investigators[0]),1)
 assert.equal(enemyFightValue(s,b,s.investigators[0]),3);assert.equal(enemyEvadeValue(s,b,s.investigators[0]),3)
 const saved=JSON.parse(JSON.stringify(s));saved.enemies[0].location='remote'
 assert.equal(enemyFightValue(saved,saved.enemies[0],saved.investigators[0]),3)
})
test('P7 07044 effect defeat grants one physical trauma only to survivors without exceeding health',()=>{
 const s=fixture('07047',2);s.investigators[1].resigned=true
 const before=s.campaign.trauma[0].physical
 run(s,d=>registeredEntry('07044').agendaRule.onReveal(d,{code:'07044'},scenarioRuntime(d,[])))
 assert.equal(s.investigators[0].defeated,true);assert.equal(s.campaign.trauma[0].physical,before+1)
 assert.equal(s.investigators[0].damage,0,'explicit defeat does not fabricate lethal damage or extra health trauma')
 assert.equal(s.investigators[1].defeated,false)
 assert.equal(s.campaign.trauma[1].physical,0)
})
test('P7 07083 first actual action ignores opportunity attack, free move leaves this protection unused',()=>{
 const s=fixture('07065');Object.assign(s.locations[1],{code:'07063',originalCode:'07063'});asset(s,'07083')
 const mob=enemy(s,{damage:2});assert.equal(getStat(s,s.investigators[0],'intellect'),s.investigators[0].intellect+1)
 assert.equal(getStat(s,s.investigators[0],'agility'),s.investigators[0].agility+1)
 move(s,legalMoves(s).find(m=>m.entityId==='07065'&&m.abilityIndex===1));settle(s)
 assert.equal(s.investigators[0].actionHistory?.entries?.length||0,0)
 move(s,{action:'draw'});settle(s);assert.equal(s.investigators[0].damage,0)
 assert.equal(s.investigators[0].actionHistory.entries.length,1)
 const saved=JSON.parse(JSON.stringify(s));move(saved,{action:'draw'});settle(saved)
 assert.equal(saved.investigators[0].damage,2);assert.equal(saved.enemies.find(e=>e.id===mob.id).location,saved.investigators[0].location)
})
test('P7 07150 tickets pay for free legal moves and fully flooded destination is rejected before payment',()=>{
 const s=fixture('07143'),joe=asset(s,'07150');const actions=s.investigators[0].actionsLeft
 createMechanicsApi(s).water.set('remote',2)
 assert.equal(legalMoves(s).some(m=>m.assetId===joe.id),false)
 assert.equal(joe.uses,3)
 createMechanicsApi(s).water.set('remote',1)
 const command=legalMoves(s).find(m=>m.assetId===joe.id);assert.ok(command);move(s,command);settle(s)
 assert.equal(s.investigators[0].location,'remote');assert.equal(s.investigators[0].assets.find(a=>a.id===joe.id).uses,2)
 assert.equal(s.investigators[0].actionsLeft,actions)
})
test('P7 07150 actually leaves play on controller elimination and is removed instead of discarded',()=>{
 const s=fixture('07143',2);const joe=asset(s,'07150')
 run(s,d=>scenarioRuntime(d,[]).defeat(d.investigators[0]))
 assert.equal(s.investigators[0].assets.some(a=>a.id===joe.id),false)
 assert.equal(s.investigators[0].discard.includes('07150'),false)
 assert.equal(s.removedFromGame.filter(c=>c==='07150').length,1)
})
test('P7 07150 returning Joe to hand removes him instead without a duplicate hand copy',()=>{
 const s=fixture('07143'),joe=asset(s,'07150')
 run(s,d=>executeDescriptor(d,{inv:d.investigators[0],source:{code:'testTicP7ReturnJoe'},descriptor:registeredEntry('testTicP7ReturnJoe').abilities[0],events:[],context:{assetId:joe.id},silent:true}))
 assert.equal(s.investigators[0].assets.some(a=>a.id===joe.id),false)
 assert.equal(s.investigators[0].hand.includes('07150'),false)
 assert.equal(s.investigators[0].discard.includes('07150'),false)
 assert.equal(s.removedFromGame.filter(c=>c==='07150').length,1)
})
test('P7 07050 local shared key requirement and group clue cost grant only the acting investigator green',()=>{
 const s=fixture('07050',2),api=createMechanicsApi(s)
 api.keys.initialize([{color:'green',revealed:true},{color:'blue',revealed:true,holder:'investigator:1'}])
 s.investigators[0].clues=1;s.investigators[1].clues=3
 const command=ability(s,'07050');assert.ok(command);move(s,command);settle(s)
 assert.equal(s.investigators[0].clues+s.investigators[1].clues,0)
 assert.deepEqual(createMechanicsApi(s).keys.at('investigator:0'),['green'])
 assert.equal(ability(s,'07050'),undefined,'green is no longer set aside')
 const t=fixture('07050',2);createMechanicsApi(t).keys.initialize([{color:'green',revealed:true},{color:'blue',revealed:true,holder:'investigator:1'}])
 t.investigators[0].clues=4;t.investigators[1].location='remote'
 assert.equal(ability(t,'07050'),undefined,'remote blue does not qualify')
})
test('P7 07052 reveal fully floods; another local green holder permits resign while keys and clues are left correctly',()=>{
 const s=fixture('07052',2);s.locations[0].revealed=false
 const api=createMechanicsApi(s);api.keys.initialize([{color:'green',revealed:true,holder:'investigator:1'},{color:'red',revealed:true,holder:'investigator:0'}])
 run(s,d=>revealLocation(d,'07052',[],0));assert.equal(createMechanicsApi(s).water.level('07052'),2)
 s.investigators[0].clues=3;move(s,ability(s,'07052'));settle(s)
 assert.equal(s.investigators[0].resigned,true);assert.equal(s.investigators[0].clues,0)
 assert.deepEqual(createMechanicsApi(s).keys.at('location:07052'),['red'])
 assert.deepEqual(createMechanicsApi(s).keys.at('investigator:1'),['green'])
 const t=fixture('07052',2);createMechanicsApi(t).keys.initialize([{color:'green',revealed:true,holder:'investigator:1'}]);t.investigators[1].location='remote'
 assert.equal(ability(t,'07052'),undefined)
})
test('P7 07062b health scales once per investigator and prevents actual opportunity attack',()=>{
 const s=fixture('07065',2),mob=enemy(s,{code:'07062b',originalCode:'07062b',health:4,damage:2})
 assert.equal(enemyHealth(s,mob),12);const before=s.investigators[0].damage
 move(s,{action:'draw'});settle(s);assert.equal(s.investigators[0].damage,before)
 assert.equal(enemyHealth(JSON.parse(JSON.stringify(s)),s.enemies[0]),12)
})
test('P7 07065 resource-paid free move is no ordinary action and rejects non-Innsmouth destinations',()=>{
 const s=fixture('07065');Object.assign(s.locations[1],{code:'07063',originalCode:'07063'})
 const before=s.investigators[0].resources,actions=s.investigators[0].actionsLeft
 const command=legalMoves(s).find(m=>m.entityId==='07065'&&m.abilityIndex===1);assert.ok(command)
 move(s,command);settle(s)
 assert.equal(s.investigators[0].location,'remote');assert.equal(s.investigators[0].resources,before-2)
 assert.equal(s.investigators[0].actionsLeft,actions)
 const t=fixture('07065');assert.equal(legalMoves(t).some(m=>m.entityId==='07065'&&m.abilityIndex===1),false)
})
test('P7 07142 entry test occurs only when flooded and applies exactly one damage on failure',()=>{
 const dry=fixture('07142');dry.investigators[0].location='remote';move(dry,{action:'move',locationId:'07142'});settle(dry)
 assert.equal(dry.lastTestResult,undefined)
 const s=fixture('07142');s.investigators[0].location='remote';s.chaosBag=['autofail'];createMechanicsApi(s).water.set('07142',1)
 move(s,{action:'move',locationId:'07142'});settle(s)
 assert.equal(s.lastTestResult.success,false);assert.equal(s.lastTestResult.difficulty,2)
 assert.equal(s.investigators[0].damage,1);assert.ok(ability(s,'07142'))
})
test('P7 07047 random hidden key preserves physical identity and deterministic save',()=>{
 const s=fixture('07047');s.locations[0].revealed=false
 createMechanicsApi(s).keys.initialize([{color:'red',revealed:false},{color:'yellow',revealed:false},{color:'blue',revealed:true}])
 const saved=JSON.parse(JSON.stringify(s))
 for(const state of [s,saved])run(state,d=>revealLocation(d,'07047',[],0))
 assert.deepEqual(s.scenarioFlags.mechanics,saved.scenarioFlags.mechanics)
 assert.deepEqual(createMechanicsApi(s).keys.at('location:07047'),['unrevealed'])
 assert.deepEqual(createMechanicsApi(s).keys.at('setAside').sort(),['blue','unrevealed'])
 run(s,d=>revealLocation(d,'07047',[],0))
 assert.equal(createMechanicsApi(s).keys.at('location:07047').length,1,'already revealed does not place another key')
})
test('P7 07063 real two-action draw is personal once per game and rejects remote activation',()=>{
 const s=fixture('07063',2),before=s.investigators[0].actionsLeft
 const command=ability(s,'07063');assert.ok(command);move(s,command);settle(s)
 assert.equal(s.investigators[0].hand.length,4);assert.equal(s.investigators[0].actionsLeft,before-2)
 assert.equal(ability(s,'07063'),undefined)
 const saved=JSON.parse(JSON.stringify(s));saved.currentSeat=1;saved.turnSeat=1
 assert.ok(ability(saved,'07063'),'second player retains personal use after save')
 saved.investigators[1].location='remote'
 assert.notEqual(validateMove(saved,1,{action:'entityAbility',entityId:'07063',abilityIndex:0}),null)
})
test('P7 07064 split healing spends one real action and survives a pending-choice save',()=>{
 const s=fixture('07064');s.investigators[0].damage=1;s.investigators[0].horror=2
 move(s,ability(s,'07064'));assert.ok(s.pendingChoice)
 const saved=JSON.parse(JSON.stringify(s))
 for(const state of [s,saved])settle(state,c=>c.source==='07064'?(c.options.some(o=>o.id==='damage')?'damage':'horror'):null)
 assert.equal(s.investigators[0].damage,0);assert.equal(s.investigators[0].horror,1)
 assert.deepEqual(s.investigators,saved.investigators);assert.equal(ability(s,'07064'),undefined)
 const empty=fixture('07064');assert.equal(ability(empty,'07064'),undefined)
})
test('P7 07067 searches only top six, returns remainder, shuffles once and keeps optional selection',()=>{
 const s=fixture('07067');s.investigators[0].deck=['01016',...Array(6).fill('01088')]
 move(s,ability(s,'07067'));settle(s)
 assert.equal(s.investigators[0].hand.length,0,'Item below searched six is unavailable')
 const t=fixture('07067');t.investigators[0].deck=['01088','01016'];move(t,ability(t,'07067'));settle(t,c=>c.kind==='search'?'0':null)
 assert.deepEqual(t.investigators[0].hand,['01016']);assert.deepEqual(t.investigators[0].deck,['01088'])
 assert.equal(ability(t,'07067'),undefined)
})
test('P7 07068 gains exactly four resources for two actions and keeps separate personal limit',()=>{
 const s=fixture('07068'),before=s.investigators[0].resources,actions=s.investigators[0].actionsLeft
 move(s,ability(s,'07068'));settle(s)
 assert.equal(s.investigators[0].resources,before+4);assert.equal(s.investigators[0].actionsLeft,actions-2)
 assert.equal(ability(s,'07068'),undefined)
})
test('P7 07069 only failed investigation at this physical location mixes encounter top into private deck',()=>{
 const s=fixture('07069');createMechanicsApi(s).scenarioDecks.initialize('leads',['07076'],{shuffle:false});s.encounterDeck=['01136','01135']
 run(s,d=>reactionWindow(d,'investigateFail',{when:'investigateFail',seat:0,location:'remote'},[]))
 assert.equal(s.encounterDeck.length,2)
 run(s,d=>reactionWindow(d,'investigateFail',{when:'investigateFail',seat:0,location:'07069'},[]))
 assert.deepEqual(s.encounterDeck,['01136']);assert.deepEqual(createMechanicsApi(s).scenarioDecks.cards('leads').sort(),['01135','07076'])
})
test('P7 07143 forbids card placement on either endpoint, permits setup and later removal',()=>{
 const s=fixture('07143'),a=createMechanicsApi(s)
 assert.equal(a.barriers.change('07143','remote',1),false)
 assert.equal(a.barriers.set('remote','07143',2,{setup:true}),2)
 assert.equal(a.barriers.change('remote','07143',1),false)
 assert.equal(a.barriers.change('07143','remote',-1),1)
 assert.equal(createMechanicsApi(JSON.parse(JSON.stringify(s))).barriers.count('remote','07143'),1)
})
test('P7 07149 places only missing edges and surges when Coastline prevents every placement',()=>{
 const s=fixture('07143');s.encounterDeck=['dissonantVoices','07149']
 run(s,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(createMechanicsApi(s).barriers.count('07143','remote'),0);assert.equal(s.encounterDeck.length,0)
 const t=fixture('07069');createMechanicsApi(t).scenarioDecks.initialize('leads',[],{shuffle:false});t.encounterDeck=['dissonantVoices','07149']
 run(t,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(createMechanicsApi(t).barriers.count('07069','remote'),1);assert.deepEqual(t.encounterDeck,['dissonantVoices'])
 t.encounterDeck.push('07149');run(t,d=>drawEncounter(d,d.investigators[0],[]))
 assert.equal(createMechanicsApi(t).barriers.count('07069','remote'),1);assert.equal(t.encounterDeck.length,0)
})
export const EARLY_TEST_CASES = [
  {
    "code": "07042",
    "scenarioId": "thePitOfDespair",
    "positive": "advance first agenda: revealed flood +1 and future reveals +1 exactly once",
    "negative": "future reveal applies reminder after agenda leaves active deck; partial→full; air5 once not twice",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/ThePitOfDespair/Awakening.hs",
        "sha256": "45947d3e39a9592ec10b78a2b027df61a90c28d2fe3e824a624745c9e6d7bd8b"
      }
    ],
    "requires": []
  },
  {
    "code": "07043",
    "scenarioId": "thePitOfDespair",
    "positive": "advance second agenda: all revealed/future reveals fully flooded",
    "negative": "replace earlier +1 reminder; no stacked +1 rule",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/ThePitOfDespair/TheWaterRises.hs",
        "sha256": "6f77ed87cc92b67cf9cee203f068540923e6cac76742d1d640004e1a12a3bb5d"
      }
    ],
    "requires": []
  },
  {
    "code": "07044",
    "scenarioId": "thePitOfDespair",
    "positive": "advance final agenda defeats each surviving investigator and physical trauma1",
    "negative": "already resigned/defeated is not defeated again",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/ThePitOfDespair/SacrificeForTheDeep.hs",
        "sha256": "acd9c520d13577e2c46e30ecdfbbcdb171cf45da254746bbdf5cc10081061d21"
      }
    ],
    "requires": []
  },
  {
    "code": "07045",
    "scenarioId": "thePitOfDespair",
    "positive": "3/player group clue advance spawns physical set-aside Amalgam, shuffles exact set-asides/discard, fills free down/left/right grid cells, flashbackI once",
    "negative": "insufficient group clues no payment; no duplicate cells/cards on resume",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Act/Cards/TheInnsmouthConspiracy/ThePitOfDespair/ThePit.hs",
        "sha256": "520c0cd827f44c63125b6c42d203e5350d060bae480abf4942eced482754fb8c"
      }
    ],
    "requires": [
      "early-grid",
      "early-flashbacks"
    ]
  },
  {
    "code": "07046",
    "scenarioId": "thePitOfDespair",
    "positive": "reveal location while act2 fills only empty down/left/right cells from tunnel deck",
    "negative": "empty deck and occupied cells do not duplicate; all surviving resigned→R1",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Act/Cards/TheInnsmouthConspiracy/ThePitOfDespair/TheEscape.hs",
        "sha256": "445270543879359bd12f9d97f7be5e1daabac3863f03e14ebded80ba86949b3f"
      }
    ],
    "requires": [
      "early-grid"
    ]
  },
  {
    "code": "07047",
    "scenarioId": "thePitOfDespair",
    "positive": "real reveal places one opaque facedown key from reference pool",
    "negative": "no pool key→no crash; save/observer does not reveal chosen color",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/ThePitOfDespair/UnfamiliarChamber.hs",
        "sha256": "171056029f3bda3555263bc661c97ae7e48d504a9103dc08ff728c222eb3daa2"
      }
    ],
    "requires": []
  },
  {
    "code": "07048",
    "scenarioId": "thePitOfDespair",
    "positive": "shroud decreases by total keys held by all local investigators; yellow+clue0 flashbackII removes cultist",
    "negative": "remote keys excluded; missing yellow/positive clues hides free action; group/game once",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/ThePitOfDespair/BoneRiddenPit.hs",
        "sha256": "62b0dfcc64a228875f314f85610b793455389b9c87c03fce068bd85b11a98eea"
      }
    ],
    "requires": [
      "early-flashbacks"
    ]
  },
  {
    "code": "07049",
    "scenarioId": "thePitOfDespair",
    "positive": "turn ending here without key horror1; red+clue0 flashbackIII removes tablet",
    "negative": "turn elsewhere or any key prevents horror; flashback group/game once",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/ThePitOfDespair/FishGraveyard.hs",
        "sha256": "81a835c1aa282147b72230acbb0e866fccd0845650f872871274b385281de46b"
      }
    ],
    "requires": [
      "early-flashbacks"
    ]
  },
  {
    "code": "07050",
    "scenarioId": "thePitOfDespair",
    "positive": "local blue OR local total3keys permits spend2/player local group clues, acting investigator gains set-aside green",
    "negative": "remote blue/clues do not satisfy local cost; absent green prevents paying",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/ThePitOfDespair/AltarToDagon.hs",
        "sha256": "33353507ef7aa207e3759954c7593d1d24be1eaecae9d7a0e0161b1ba94916bf"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07051",
    "scenarioId": "thePitOfDespair",
    "positive": "reveal places blue set-aside key; purple+no clues flashbackIV removes elderthing",
    "negative": "no duplicate blue on resume; purple missing or clues>0 no flashback",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/ThePitOfDespair/IdolChamber.hs",
        "sha256": "bd6bdd4c2227d07ba125af9618be4efed6d3a55b67a83081f1bca45a9c0ee4f1"
      }
    ],
    "requires": [
      "early-flashbacks"
    ]
  },
  {
    "code": "07052",
    "scenarioId": "thePitOfDespair",
    "positive": "reveal full flood; any local holder green permits actor resign, actor clues return pool and actor keys drop on this location",
    "negative": "remote green insufficient; other investigators keys/clues untouched",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/ThePitOfDespair/SealedExit.hs",
        "sha256": "85fb1c9cc5340b5d68c7f04b85e6ab19a6aa01eee2e276f254915cbee2e394e7"
      }
    ],
    "requires": []
  },
  {
    "code": "07053",
    "scenarioId": "thePitOfDespair",
    "positive": "evade by2 takes chosen enemy key; engage holder chooses own key or enemy attack; defeat goes depths via replacement",
    "negative": "evadeby1 no key; no heldkey no forced choice; depth move clears damage/doom, preserves physical identity and obeys key exit",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/ThePitOfDespair/TheAmalgam.hs",
        "sha256": "d0254e27a14b046eecc9946d5d224363036297b48f1ab8a4c7524ff080d8cce3"
      }
    ],
    "requires": [
      "early-depths"
    ]
  },
  {
    "code": "07054",
    "scenarioId": "thePitOfDespair",
    "positive": "failed agility3 readies/moves/engages/attacks in-play Amalgam; depths version returns and attacks",
    "negative": "success does nothing; no second cloned Amalgam",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Treachery/Cards/TheInnsmouthConspiracy/ThePitOfDespair/Blindsense.hs",
        "sha256": "79b91052a86b8bc7b1bf2a7fff04fd062dedd855f27ecbc41df6503bc1c7ae4b"
      }
    ],
    "requires": [
      "early-depths"
    ]
  },
  {
    "code": "07055",
    "scenarioId": "thePitOfDespair",
    "positive": "depths Amalgam returns engaged, otherwise moves todepths and this treachery surges",
    "negative": "exactly one real next encounter draw; outofplay identity survives JSON",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Treachery/Cards/TheInnsmouthConspiracy/ThePitOfDespair/FromTheDepths.hs",
        "sha256": "f60465af93b65dbb4cf21ef47ce8aa92b30c04aa8136a25188457b33f390c1c0"
      }
    ],
    "requires": [
      "early-depths"
    ]
  },
  {
    "code": "07057",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "defeat nonkidnapper Suspect transfers all enemy clues to killer and records outForBlood; back shuffles winged/nightgaunts/discard and conditional Dawson slot-free",
    "negative": "kidnapper exclusion; no duplicate record/physical enemies on replay",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/DecrepitDecay.hs",
        "sha256": "0b58911a208a9107f519293d7e8d8fe161a5a5cc1f40ba5575a6f52f749bb759"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07058",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "same Suspect defeat rule, advancing yields R1",
    "negative": "notkidnapper filter and no active-stage double subscription",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/GrowingSuspicion.hs",
        "sha256": "2be4d43e4008ea87d65e8ab55338a9cf6c12759076f2edd88fa03f13a9bbe34e"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07059",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "same Suspect defeat rule in pursuit; advancing yields R1",
    "negative": "notkidnapper filter; inherited group rule only once",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/FranticPursuit.hs",
        "sha256": "ad0ad67bd7048b87c0078fb41c10ecb9298aeab4004821e9e40c87244b3ce662"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07060",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "spend X/player group clues and parley reveal min(X,3) leads, cross out all revealed, actually draw chosen1 and shuffle rest+encountertop; endround optional accusation",
    "negative": "X exact cost with max3 reveal; cannot accuse midround; hidden answers never client-visible",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Act/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/TheSearchForAgentHarper.hs",
        "sha256": "789552b3d067bb6c33dc406c60f3d1fcfedfdcec5e2d6f3e9adc053e6ecb1405"
      }
    ],
    "requires": [
      "early-scenario-decks",
      "early-costs-windows"
    ]
  },
  {
    "code": "07061",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "kidnapper loses aloof/cannotparley/+player health; objective solo OR multiplayer AND checks victory and hideoutclues",
    "negative": "nonkidnapper unaffected; 2players one condition not enough",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Act/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/TheRescue.hs",
        "sha256": "21de3168a3c11214d8c267a2cbe6c4265ae0c7b513e1d67e5224d901f54dc29a"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07062a",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "public crossed-off names update when leads revealed, private answer remains under story; wrong-one accusation flips exact story physical id into Angry Mob atSquare",
    "negative": "zero-correct accusation resigns without mob; no duplicated front/back physical entity",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Story/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/FindingAgentHarper.hs",
        "sha256": "a04c46f55edcc6978f8b9883c675b453a4aea210e8cdeba6b8ed6ebfa6c530d5"
      }
    ],
    "requires": [
      "early-scenario-decks"
    ]
  },
  {
    "code": "07062b",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "Angry Mob hunter/massive/retaliate +4/player health and never AoO",
    "negative": "regular enemy/effect attacks still allowed; no health bonus twice",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/AngryMob.hs",
        "sha256": "092bebba299f881f40b31dc034cd652277dc50824c2acdad668ccb405c12543a"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07063",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "real two-action local ability draws4 and once/game/investigator limit",
    "negative": "one remaining action unavailable; another investigator gets own use if printedlimit personal",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/MarshRefinery.hs",
        "sha256": "719aa8924ec721dae93d778a8958cb2112680c69daa3de842d088433f115fbe5"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07064",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "one-action local split heal2 damage/horror (0/2,1/1,2/0), once/game",
    "negative": "cannot heal total>2; remote subject cannot use; used action unavailable",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/GilmanHouse.hs",
        "sha256": "c71b205a35e8f642a35e27bdee3b9a032779ee2a67e6552f76781b8e06d9e4e1"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07065",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "resign action; free spend2resources move connected Innsmouth",
    "negative": "nonInnsmouth or unconnected absent; noresources no option; actual move triggers",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/InnsmouthSquare.hs",
        "sha256": "da31c13ab3f99acbba89b90be9312dba765f9eaec185ee96f1e9c8fc13de0ead"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07066",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "investigate successby>=3 privately peeks top lead then shuffles, group once/round",
    "negative": "successby2 no peek; other observer not given secret lead; saved peek not rerandomized",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/InnsmouthHarbour.hs",
        "sha256": "62474130930a5df064ef319bbb002295b9021e14beb6ae965c39f711ed8a73f3"
      }
    ],
    "requires": [
      "early-scenario-decks"
    ]
  },
  {
    "code": "07067",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "action searches actual top6 Item and adds selected card/shuffles, once/game",
    "negative": "top7 Item unavailable; nonItem unavailable; genuine search windows",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/FirstNationalGrocery.hs",
        "sha256": "34e483d41718677a7f74a760eee5ac16171b9ed22b4a5c3ccb4940f27db7ee04"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07068",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "two-action gain4resource once/game",
    "negative": "oneaction or gainResources blocked prevents activation/payment",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/FishStreetBridge.hs",
        "sha256": "97a563687ec1751c7155c5295807f72bb2aa7d9e8c80a09abefb585cefc0ad24"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07069",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "investigate-fail here moves encountertop into Leads and shuffles",
    "negative": "noninvestigate/otherlocation/success no change; empty encounterpile refills by rules",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/TheLittleBookshop.hs",
        "sha256": "727f768a47868dd82ecf702b8b1f818874adc86d15a4e23306b70e028bd905aa"
      }
    ],
    "requires": [
      "early-scenario-decks"
    ]
  },
  {
    "code": "07070",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "drawn lead location enters play via revelation; last clue discovered blindly removes top lead fromgame",
    "negative": "moving/removing clue without discovering does not trigger; no leaked removedcode",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/EsotericOrderOfDagon.hs",
        "sha256": "8a09e60eef45eb074d3bf0cfa7f66ff10daf6c62ef113caebe6b820f14a35c58"
      }
    ],
    "requires": [
      "early-scenario-decks"
    ]
  },
  {
    "code": "07071",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation places hideout; local Humanoid fight+2/evade-2",
    "negative": "nonHumanoid andremote enemy unchanged; moving enemy updates aura immediately",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/SawboneAlley.hs",
        "sha256": "d70fb96b89638bf7dcbb5d6729f37d2be5c61e513e8d385de379cc41155efd74"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07072",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation places hideout; own shroud minus2perdoom; investigate failure putsdoom1",
    "negative": "failure elsewhere or noninvestigate does not place; shroud floor0",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/ShorewardSlums.hs",
        "sha256": "3d04a835eaf36cf1fb29d539526b7f2d4c3c1ee16c869da3f3ad465861c583aa"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07073",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "successby3 investigating here choose actual encounterdraw OR shuffle encountertop intoLeads",
    "negative": "by2 no choice; unchosen branch no sideeffect",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/TheHouseOnWaterStreet.hs",
        "sha256": "ee7f2bc3efa806ff1d08baf4229e65892a5312fce0e723da629acba13aab30d7"
      }
    ],
    "requires": [
      "early-scenario-decks"
    ]
  },
  {
    "code": "07074",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "defeated enemy atJail shuffles actual enemy card intoLeads instead ofdiscard",
    "negative": "enemy elsewhere untouched; victory/removed destination precedence must follow replacement rule",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/InnsmouthJail.hs",
        "sha256": "fad07e6b87dd1a2a3f5d698700802bf4427fb5038836075af224dd96321355ba"
      }
    ],
    "requires": [
      "early-scenario-decks",
      "early-enemy-auras"
    ]
  },
  {
    "code": "07075",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "twoactions+clue0 peek topLead; noVictory discards actuallead, Victory retains top; group once/game",
    "negative": "positiveclues no ability; otherplayer cannot repeat; no hiddenpeek leak",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/NewChurchGreen.hs",
        "sha256": "7a9c2a196cd7a37c4f7d2c72baaa03f61892bcdef8852b19aba4222efd7d27d1"
      }
    ],
    "requires": [
      "early-scenario-decks",
      "early-costs-windows"
    ]
  },
  {
    "code": "07076",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation spawn atHarbour withplayerclues; parley agility2 success transferclue andzero→victory; failure damage1",
    "negative": "remote parley unavailable; kidnapper cannotparley; failure no clue",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/RobertFriendlyDisgruntledDockworker.hs",
        "sha256": "d44420c286210b50c00b0c02eb453d70bd5e7920a67954cbcf5c76a311e59d7b"
      }
    ],
    "requires": []
  },
  {
    "code": "07077",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation spawn atBridge playerclues; agility3 parley success transferclue zero→victory",
    "negative": "failed test no clue/victory; remote parley unavailable",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/ZadokAllenDrunkAndDisorderly.hs",
        "sha256": "e234d964c8db4805fd43eced967fccc03156102d197209e0112ead96c368c9dd"
      }
    ],
    "requires": []
  },
  {
    "code": "07078",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation spawn atGrocery playerclues; pay discarded handicons>=3 then transferclue zero→victory",
    "negative": "2icons cannotpay; only physical chosen cardsdiscard; signed/wild count by rules",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/BrianBurnhamWantsOut.hs",
        "sha256": "35ce5a2530068285c0df89f6671fde2c76ce91fda56a1863bca769b6567af161"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07079",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation spawn atRefinery playerclues; will2 parley successclue/failurehorror1",
    "negative": "remote/kidnapper cannotparley; fail no clue",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/BarnabasMarshTheChangeIsUponHim.hs",
        "sha256": "442ac225fdbd9b7cae667ec1d18e69ead631979e822503c2fd8a4acde2aa3496"
      }
    ],
    "requires": []
  },
  {
    "code": "07080",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation spawn atBookshop playerclues; will3 parley successclue zero→victory",
    "negative": "failure no clue; no duplicate victory physical entity",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/JoyceLittleBookshopOwner.hs",
        "sha256": "4d6d423df124fd38fbf6c6489aeb7454a9557416aa4a32a08673175f4bfa0319"
      }
    ],
    "requires": []
  },
  {
    "code": "07081",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "revelation spawn atGilman playerclues; pay3resources parley transferclue zero→victory",
    "negative": "2resources cannotpay, no partial; bankedresources count properly",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/TheVanishingOfElinaHarper/OtheraGilmanProprietessOfTheHotel.hs",
        "sha256": "2b98de8f777468f611c25729e918a7df1171b2e12b95ccfaf59fa018fda5f076"
      }
    ],
    "requires": [
      "early-costs-windows"
    ]
  },
  {
    "code": "07082",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "controller getswill/combat1; after actual/canceled enemyattack local attackedinvestigator draws1 via exhaustedDawson",
    "negative": "remote attack no trigger; exhaustedno trigger; threatened seat draws not controller",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Asset/Assets/ThomasDawsonSoldierInANewWar.hs",
        "sha256": "d3618572ef61f55e6c0744fd08b8239919b0433863fd16a00de5a4fac47a4f5c"
      }
    ],
    "requires": [
      "early-story-assets"
    ]
  },
  {
    "code": "07083",
    "scenarioId": "theVanishingOfElinaHarper",
    "positive": "controller intellect/agility1 and first actual action eachturn noAoO",
    "negative": "second action provokes; free abilities do not consume first action; extrasame-round turn resets",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Asset/Assets/ElinaHarperKnowsTooMuch.hs",
        "sha256": "c094a57e6f30138a28ffd6270d928f0d8fc47eee7aa3381c12f9b7e50f72ea43"
      }
    ],
    "requires": [
      "early-story-assets"
    ]
  },
  {
    "code": "07124",
    "scenarioId": "inTooDeep",
    "positive": "activeagenda globalSuspects losealoof/cannotparley; turnend fullyflood damage1; advance Coastal flood+1 and setasides/discard shuffle",
    "negative": "partialflood no damage; inactiveagenda no duplicate effect",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/InTooDeep/BarricadedStreets.hs",
        "sha256": "b6e993d5e8f2a592a8d71648f773442ebc8d8961444711a10dcccaa5494dd8da"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07125",
    "scenarioId": "inTooDeep",
    "positive": "fullyflood turnend damage1+horror1; advance Midtown flood+1, spawn physicalMob Square and random hiddenkey",
    "negative": "missing key pool no leak/crash; turnelsewhere no harm",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/InTooDeep/RelentlessTide.hs",
        "sha256": "29c26155e4bf82d1e230728856f5e4d23d3486a67a15b7e84d409f3e3bd46e27"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07126",
    "scenarioId": "inTooDeep",
    "positive": "fullyflood turnend damage1+horror1+randomdiscard1; advance allflood+1 then encounterdraw playerorder",
    "negative": "emptyhand no crash; exactone discard, resumable random",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/InTooDeep/FloodedStreets.hs",
        "sha256": "b174349c54d895e56e7df3d20ad72d085360a1e7cd5a7c15f04e63d22d2b0218"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07127",
    "scenarioId": "inTooDeep",
    "positive": "fullyflood turnend damage1+horror1+randomdiscard2; advance recordInnsmouthConsumed and defeatnonresigned+physicaltrauma1",
    "negative": "1card discardsone; resigned safe; no double trauma",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Agenda/Cards/TheInnsmouthConspiracy/InTooDeep/RageOfTheDeep.hs",
        "sha256": "4caf153697b1edc2c57cbe1d3d6f0d77770fb51712f34b8a6b2e3ea774712925"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07128",
    "scenarioId": "inTooDeep",
    "positive": "free group clues player+1 removeone chosen adjacentbarrier; allsurvivorsresigned→recordVehicles+R1",
    "negative": "one fewerclue no partialcost; zero barriers no ability",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Act/Cards/TheInnsmouthConspiracy/InTooDeep/ThroughTheLabyrinth.hs",
        "sha256": "178ab3ca4360c643987f50601964b2abbd723992049010855e1fca87e64298e9"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows"
    ]
  },
  {
    "code": "07129",
    "scenarioId": "inTooDeep",
    "positive": "reveal hiddenkey; twoactions intellect3 parley succeeds removeone adjacentbarrier",
    "negative": "failedtest retains barrier; allblockedchoose candidateslegal",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/EsotericOrderOfDagonInTooDeep.hs",
        "sha256": "4de7dd650229fb766444df78083898d3991d859d99060281df91a3c609187a5b"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows"
    ]
  },
  {
    "code": "07130",
    "scenarioId": "inTooDeep",
    "positive": "oneaction will(player) parley removebarrier; group7keys flashbackVII +1token",
    "negative": "remote keys count for group7; 6 insufficient; campaign reward once",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/SawboneAlleyInTooDeep.hs",
        "sha256": "b42d68f4493e34081518304d72a5ed5da36280c7d9d353fdce1143c26e816e92"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows",
      "early-flashbacks"
    ]
  },
  {
    "code": "07131",
    "scenarioId": "inTooDeep",
    "positive": "reveal hiddenkey; free damage1cost then removebarrier parley",
    "negative": "cost paid before effect; no damagecapacity/zero barrier invalid",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/ShorewardSlumsInTooDeep.hs",
        "sha256": "142a224fd00da94b4db774e23fbce4c84c21294bfad3457e55a6390f59394624"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows"
    ]
  },
  {
    "code": "07132",
    "scenarioId": "inTooDeep",
    "positive": "reveal hiddenkey; free selected handdiscard1cost then removebarrier",
    "negative": "no hand or nondiscardable weakness cannotpay; no randomdiscard substitution",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/TheHouseOnWaterStreetInTooDeep.hs",
        "sha256": "18a1ccfb3583ae68883148bdd974fd7dd967e1662c8666bc8e925db1ff62e052"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows"
    ]
  },
  {
    "code": "07133",
    "scenarioId": "inTooDeep",
    "positive": "action spend3resources removebarrier; blackkey holder flashbackVIII remove chosen symbol",
    "negative": "2resources no cost; other local holder black does notgrant actor requirement",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/InnsmouthJailInTooDeep.hs",
        "sha256": "002118e09199dcbe3d0ac532492585e6c3d9375b65a92f4e9b945a85a855490b"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows",
      "early-flashbacks"
    ]
  },
  {
    "code": "07134",
    "scenarioId": "inTooDeep",
    "positive": "reveal hiddenkey; action clue0 removebarrier",
    "negative": "positiveclues/zero barriers unavailable",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/NewChurchGreenInTooDeep.hs",
        "sha256": "1bf4225cd0f166819edf9f78f738b4e8c4750ecee3972d9ad0383bde8d7070e6"
      }
    ],
    "requires": [
      "early-barriers"
    ]
  },
  {
    "code": "07135",
    "scenarioId": "inTooDeep",
    "positive": "twoactions drawencountertop AS COST before barrierremove; group5keys flashbackVI optional Teachings reward",
    "negative": "encounter eliminates/moves actor before effect recheck;4keys noflashback",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/TheLittleBookshop.hs",
        "sha256": "7cfcdbb8cb1bfaf84c11c11136b84bff2f2b3baf1547f722bfe55bef50a555c0"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows",
      "early-flashbacks"
    ]
  },
  {
    "code": "07136",
    "scenarioId": "inTooDeep",
    "positive": "shroud+total adjacentbarrier count; action exactlyadd2curse cost removeonebarrier",
    "negative": "cursepool room1 cannotpay; remote barriers excluded",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/FishStreetBridge.hs",
        "sha256": "049f67b7c83bdac52fb73f2b7d04ac1290783350ed0bd026eb30ec9ef84e5c08"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows",
      "early-enemy-auras"
    ]
  },
  {
    "code": "07137",
    "scenarioId": "inTooDeep",
    "positive": "entry fromconnected addsbarrier traversededge; action tests actor lowest modified skill2 andsuccessremovebarrier",
    "negative": "teleport/nonconnected entry no barrier; tiedlowest playerchooses; failedtestretain",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/FirstNationalGrocery.hs",
        "sha256": "72366c9df48305bd62c42fb4d06a031a9c4b6241cbe71bc0ea0b5ae2ce015e6c"
      }
    ],
    "requires": [
      "early-barriers",
      "early-grid"
    ]
  },
  {
    "code": "07138",
    "scenarioId": "inTooDeep",
    "positive": "afterentry optional moveHouseWaterStreet; twoactions removebarrier parley",
    "negative": "entryelsewhere no reaction; target missing/blocked no illegalmove",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/InnsmouthHarbourInTooDeep.hs",
        "sha256": "556e5016ab45d6fd1c342dffe81f942d2b5b340662a38d637d4b37f3408047de"
      }
    ],
    "requires": [
      "early-barriers"
    ]
  },
  {
    "code": "07139",
    "scenarioId": "inTooDeep",
    "positive": "reveal setasideShoggoth exhausted; action movesone barrier toanotherconnectededge; group2keys flashbackV Joe",
    "negative": "cannotmove tosameedge; no source/dest no ability;1key noflashback",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/InnsmouthSquare.hs",
        "sha256": "5d86c3c6b3b3c0b024ab3e9b2de3fae83003ed330596cbbc677843ee9c0a835c"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows",
      "early-flashbacks"
    ]
  },
  {
    "code": "07140",
    "scenarioId": "inTooDeep",
    "positive": "reveal hiddenkey; action choicecombat2 OR agility2 removebarrieronsuccess",
    "negative": "onlyselected skilltested; fail no remove",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/GilmanHouse.hs",
        "sha256": "a0e464c99210618acfed96ca485bb38c0ba359f4d82f9ff7e96e092ebcfd76db"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows"
    ]
  },
  {
    "code": "07141",
    "scenarioId": "inTooDeep",
    "positive": "free holder>=1key moveconnected throughbarrier? ordinarymovement respectsbarriers; action discardcontrolledasset COST removebarrier",
    "negative": "nokey absent; permanent/cannotdiscard cannotcost; keyholder conditionactor notlocalgroup",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/MarshRefinery.hs",
        "sha256": "b60c231e284edb8badb8e2e5169ae1505e620d7a7ff70c452172299a573719b5"
      }
    ],
    "requires": [
      "early-barriers",
      "early-costs-windows"
    ]
  },
  {
    "code": "07142",
    "scenarioId": "inTooDeep",
    "positive": "entry whenflooded agility2 faildamage1; action resign",
    "negative": "unflooded no test; successnodamage; correctentry once",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/RailroadStation.hs",
        "sha256": "f78e57686f64c267b5e6e0802c55a52da69ae967996047fea5c738822483d46d"
      }
    ],
    "requires": []
  },
  {
    "code": "07143",
    "scenarioId": "inTooDeep",
    "positive": "reject all cardeffect addbarrier touchingCoastline",
    "negative": "setup directset2 allowed; removeexistingbarriers allowed",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Location/Cards/TheInnsmouthConspiracy/InTooDeep/DesolateCoastline.hs",
        "sha256": "c66176eb0ba47f1dc67459d2e1f7e301750dcf25fa059eb58caa331adc03d25c"
      }
    ],
    "requires": [
      "early-barriers",
      "early-enemy-auras"
    ]
  },
  {
    "code": "07144",
    "scenarioId": "inTooDeep",
    "positive": "hunter/massive +2/playerhealth; hunter ignoresbarriers andremovesall traversedbarriers",
    "negative": "nonhunter movement remainsblocked; unrelatededge barriers untouched",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/InTooDeep/InnsmouthShoggoth.hs",
        "sha256": "f7957f7ac110ab7631d52039d96522242d385da409449a9c35b47af181dfbb32"
      }
    ],
    "requires": [
      "early-barriers",
      "early-enemy-auras"
    ]
  },
  {
    "code": "07145",
    "scenarioId": "inTooDeep",
    "positive": "fight/evade +1partial +2full localflood; engagecombat2 failbarrierwest",
    "negative": "dry0; successno barrier; westmissing/Coastline prevention honored",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/InTooDeep/RavagerFromTheDeep.hs",
        "sha256": "50a3e0f568734bf6b73f4cf92665a3ae33fd2ad954a314345be19fbd8c678a5e"
      }
    ],
    "requires": [
      "early-barriers",
      "early-enemy-auras"
    ]
  },
  {
    "code": "07146",
    "scenarioId": "inTooDeep",
    "positive": "revelation enters exhaustedunengaged unlessfullyflooded; engage ifflooded immediateattack",
    "negative": "partial enters exhausted; dryengage noattack; full entersnormalreadyengaged",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Enemy/Cards/TheInnsmouthConspiracy/InTooDeep/EmergingDeepOne.hs",
        "sha256": "47b21d737340ca20d7d3fdf3a22cfbf7ad84c05ada72ae100076e660734b0eee"
      }
    ],
    "requires": [
      "early-enemy-auras"
    ]
  },
  {
    "code": "07147",
    "scenarioId": "inTooDeep",
    "positive": "shuffleencounterdiscard then for each easternsameRow location discarduntilhunterDeepOne andspawn THERE",
    "negative": "nonhunterDeepOne ignored; emptydeck bounded; own/west/otherrow excluded",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Treachery/Cards/TheInnsmouthConspiracy/InTooDeep/DeepOneInvasion.hs",
        "sha256": "7f8efcb3c06879931c89140b84290d14ebd2d15b090c04c18980efd599cf853a"
      }
    ],
    "requires": [
      "early-barriers",
      "early-scenario-decks",
      "early-grid"
    ]
  },
  {
    "code": "07148",
    "scenarioId": "inTooDeep",
    "positive": "failedwill3 forcedeastmove ignoringbarriers THEN dropallactor keys atfinal location",
    "negative": "success no move/drop; eastmissing stilldropwhereactorends; otherplayerskeys untouched",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Treachery/Cards/TheInnsmouthConspiracy/InTooDeep/PulledBack.hs",
        "sha256": "d0b999fc84d4330ff79da959588c70815d728121f8618ec5b1e8ea4c9f91ae2b"
      }
    ],
    "requires": [
      "early-barriers",
      "early-grid"
    ]
  },
  {
    "code": "07149",
    "scenarioId": "inTooDeep",
    "positive": "add1barrier to each connectedzeroedge exceptCoastline; noneadded→surge",
    "negative": "existingnonzeroedges unchanged; allprohibited edges correctly causeonesurge",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Treachery/Cards/TheInnsmouthConspiracy/InTooDeep/Inundated.hs",
        "sha256": "b0204bfa30bd3948a007d42e314c76ff3ab0021b516cd1f6f62b119402326b10"
      }
    ],
    "requires": [
      "early-barriers"
    ]
  },
  {
    "code": "07150",
    "scenarioId": "inTooDeep",
    "positive": "storyasset3tickets initialized onaward; free ticket1 moveconnectednotfullyflooded; leave removesgame",
    "negative": "0tickets/notfullyfloodedtargetnone invalid; partialallowed; physicalcode notdiscard",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Asset/Assets/JoeSargentRattletrapBusDriver.hs",
        "sha256": "3bb03a05b3060d3778e9b6fc431a15c6d265180541538b02b8de3904c5b02335"
      }
    ],
    "requires": [
      "early-story-assets"
    ]
  },
  {
    "code": "07151",
    "scenarioId": "inTooDeep",
    "positive": "permanent exhaust chooseunusedcampaign effect: removebagcurse/all floodtoken nonSanctum/killlocalnonElite",
    "negative": "choiceoncecampaign acrossJSON/scenario; no validtarget omitbranch; removingfloodtoken setsdry, notminus1; sealedcurse retained",
    "save": "Roundtrip JSON before answering a real pending choice and rerun the same authoritative move; assert identical physical zones, paid costs, limits and next RNG result.",
    "sourceFiles": [
      {
        "path": "backend/arkham-api/library/Arkham/Asset/Assets/TeachingsOfTheOrder.hs",
        "sha256": "aae0fe20eee171123ee90f0ca1b3120ed9051a1a706a43a1c60686fc42ceb55e"
      }
    ],
    "requires": [
      "early-story-assets"
    ]
  }
]
