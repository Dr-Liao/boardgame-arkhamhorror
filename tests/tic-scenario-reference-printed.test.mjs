// MAIN ONLY: copy to Mod/tests. Real registered3 reference cards, no rule mocks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { asset,enemy } from './core-fixture.mjs'
import { registerCardAbilities,registeredEntry } from '../src/engine/ability.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { randomValue } from '../src/engine/rules-state.js'
import harper from '../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/07056.js'
import lair from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07274.js'
import maelstrom from '../src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07311.js'
registerCardAbilities([harper,lair,maelstrom].filter(entry=>!registeredEntry(entry.code)))
const cancel={code:'testTicReferenceCancel',abilities:[{kind:'forced',trigger:'chaosTokenRevealed',cost:{exhaust:true},
  criteria:({source,context})=>context.token===source.cancelFace,
  resolve:({state,context,api})=>api.chaosTokens.treat({index:context.tokenIndex??state.chaos.revealed.length-1,cancel:true})}]}
const zeroCurse={code:'testTicReferenceZeroCurse',abilities:[{kind:'forced',trigger:'chaosTokenRevealed',cost:{exhaust:true},
  criteria:({context})=>context.token==='curse',resolve:({context,api})=>api.chaosTokens.treat({index:context.tokenIndex,modifier:0})}]}
registerCardAbilities([cancel,zeroCurse].filter(entry=>!registeredEntry(entry.code)))
const codes=[['07056','theVanishingOfElinaHarper'],['07274','theLairOfDagon'],['07311','intoTheMaelstrom']]
const difficulties=['easy','standard','hard','expert'],faces=['skull','cultist','tablet','elderthing']
const harder=d=>['hard','expert'].includes(d)
function fixture(id,difficulty='standard') {
  const s=chapterFixture(id),api=createMechanicsApi(s)
  s.difficulty=difficulty
  for(const [color,key]of Object.entries(s.scenarioFlags.mechanics.keys||{}))api.keys.transfer(color,key.holder,'setAside',{reveal:true})
  if(!s.scenarioFlags.mechanics.keys)api.keys.initialize(['red','yellow','green','blue','purple','white','black'].map(color=>({color,holder:'setAside',revealed:true})))
  const inv=s.investigators[0]
  Object.assign(inv,{willpower:20,combat:20,agility:20,assets:[],threat:[],engaged:[],hand:[],damage:0,horror:0,maxHealth:99,maxSanity:99,clues:4})
  s.enemies=[];s.doom=0;s.agendas[s.agendaIndex].doomThreshold=99
  for(const location of s.locations)api.water.set(location.id,0,{ignoreRestrictions:true})
  if(id==='theVanishingOfElinaHarper')enemy(s,{engagedSeat:null,damage:0,horror:0})
  if(id==='theLairOfDagon') {
    for(const color of ['red','blue'])api.keys.transfer(color,'setAside','investigator:0',{reveal:true})
    for(const color of ['green','yellow'])api.keys.transfer(color,'setAside','reference',{reveal:true})
  }
  if(id==='intoTheMaelstrom')api.keys.transfer('red','setAside',`location:${inv.location}`,{reveal:true})
  return s
}
function setSequence(s,draws) {
  s.chaosBag=[...draws]
  for(let seed=0;seed<100000;seed++) {
    const rng={rngState:seed},bag=[...draws],observed=[]
    while(bag.length)observed.push(bag.splice(Math.floor(randomValue(rng)*bag.length),1)[0])
    if(draws.every((face,index)=>observed[index]===face)){s.rngState=seed;return}
  }
  throw new Error('No deterministic physical bag sequence found')
}
function run(s,draws,fail=false,select=()=>null) {
  setSequence(s,draws)
  const execute=d=>scenarioRuntime(d,[]).test(0,'willpower',fail?99:0,()=>{})
  resolveTransaction(s,0,{action:'testActualReference'},execute)
  for(let guard=0;s.pendingChoice;guard++) {
    assert.ok(guard<100,'Reference choice loop')
    Object.assign(s,JSON.parse(JSON.stringify(s)))
    const choice=s.pendingChoice,optionId=select(choice)??choice.options.find(o=>['skip','done','self'].includes(o.id))?.id??choice.options[0].id
    resolveTransaction(s,choice.seat,{action:'choose',choiceId:choice.id,optionId},execute)
  }
  return s.lastTestResult
}
function delta(s,code,face) {
  const h=harder(s.difficulty)
  if(code==='07056')return face==='skull'?-(Number.parseInt(s.agendas[s.agendaIndex].stage,10)+Number(h)):{cultist:-2,tablet:-3,elderthing:-4}[face]
  if(code==='07274')return {skull:h?-4:-2,cultist:h?-2:0,tablet:-3,elderthing:-4}[face]
  return {skull:h?-2:-1,cultist:h?-4:-3,tablet:h?-5:-4,elderthing:h?-6:-5}[face]
}

for(const [code,id]of codes)for(const difficulty of difficulties)for(const face of faces)for(const fail of [false,true]) {
  test(`${code} actual ${difficulty} ${face} ${fail?'failure':'success'} numeric+printed effect with JSON continuation`,()=>{
    const s=fixture(id,difficulty),h=harder(difficulty),here=s.investigators[0].location
    const before=s.locations.find(loc=>loc.id===here).clues||0,value=20+delta(s,code,face)
    const draws=code==='07274'&&face==='cultist'?['cultist','0']:[face]
    const result=run(s,draws,fail)
    assert.equal(result.value,value);assert.equal(result.success,!fail);assert.equal(result.autoFail,false)
    assert.deepEqual(result.drawn,draws)
    const inv=s.investigators[0],api=createMechanicsApi(s)
    if(code==='07056') {
      const effect=face!=='skull'&&(h||fail)
      assert.equal(s.enemies[0].doom||0,face==='cultist'&&effect?(h&&fail?2:1):0)
      assert.equal(inv.horror,face==='tablet'&&effect?1:0)
      assert.equal(inv.damage,face==='tablet'&&h&&fail?1:0)
      const moved=face==='elderthing'&&effect?(h&&fail?2:1):0
      assert.equal(inv.clues,4-moved)
      assert.equal(s.locations.find(loc=>loc.id===here).clues,before+moved)
    } else if(code==='07274') {
      const dropped=face==='tablet'&&(h||fail)
      assert.deepEqual(api.keys.at('investigator:0').sort(),dropped?[]:['blue','red'])
      assert.deepEqual(api.keys.at('reference').sort(),['green','yellow'])
      assert.deepEqual(api.keys.at(`location:${here}`).sort(),dropped?['blue','red']:[])
      assert.equal(inv.damage,face==='tablet'&&h?1:0)
      assert.equal(api.chaosTokens.count('curse'),face==='elderthing'&&(h||fail)?(h?2:1):0)
    } else {
      assert.equal(s.doom,face==='cultist'&&fail?1:0)
      assert.equal(api.water.level(here),face==='tablet'&&fail?1:0)
      assert.equal(inv.damage,0)
      assert.equal(inv.horror,face==='elderthing'&&fail?1:0)
    }
  })
}

for(const difficulty of difficulties)test(`07056 ${difficulty}: nearest tie chosen by test actor; unreachable enemies retain source fallback`,()=>{
  const s=fixture('theVanishingOfElinaHarper',difficulty),first=s.enemies[0]
  const second=enemy(s,{engagedSeat:null,damage:0,horror:0})
  run(s,['cultist'],true,c=>c.options.some(o=>o.id===second.id)?second.id:null)
  assert.equal(s.enemies.find(e=>e.id===first.id).doom||0,0)
  assert.equal(s.enemies.find(e=>e.id===second.id).doom,harder(difficulty)?2:1)
  const u=fixture('theVanishingOfElinaHarper',difficulty),foe=u.enemies[0]
  u.locations.push({id:'reference-isolated',name:'孤立地点',revealed:true,connections:[],clues:0})
  foe.location='reference-isolated'
  run(u,['cultist'],true)
  assert.equal(u.enemies[0].doom,harder(difficulty)?2:1)
})

for(const difficulty of difficulties)for(const order of [['cultist','curse','0'],['curse','cultist','0']])test(`07274 ${difficulty} actual ${order.join('->')} autoFail even against difficulty0`,()=>{
  const s=fixture('theLairOfDagon',difficulty),r=run(s,order)
  assert.equal(r.autoFail,true);assert.equal(r.success,false)
})
for(const difficulty of difficulties)for(const cancelFace of ['cultist','curse'])test(`07274 ${difficulty} canceled ${cancelFace} excludes required rider component`,()=>{
  const s=fixture('theLairOfDagon',difficulty);asset(s,'testTicReferenceCancel',{cancelFace})
  const r=run(s,['cultist','curse','0'])
  assert.equal(r.autoFail,false);assert.equal(r.success,true)
})
test('07274 modifier0 curse remains revealed and must still automatically fail Lair cultist',()=>{
  const s=fixture('theLairOfDagon');asset(s,'testTicReferenceZeroCurse')
  const r=run(s,['cultist','curse','0'])
  assert.equal(r.autoFail,true)
})

for(const difficulty of difficulties)test(`07311 ${difficulty} tablet locked flood leaves only legal damage choice; carried-only key causes no horror`,()=>{
  const s=fixture('intoTheMaelstrom',difficulty),api=createMechanicsApi(s),here=s.investigators[0].location
  api.water.set(here,2,{ignoreRestrictions:true})
  run(s,['tablet'],true)
  assert.equal(s.investigators[0].damage,1);assert.equal(api.water.level(here),2)
  const t=fixture('intoTheMaelstrom',difficulty),other=createMechanicsApi(t)
  other.keys.transfer('red',`location:${t.investigators[0].location}`,'investigator:0',{reveal:true})
  run(t,['elderthing'],true)
  assert.equal(t.investigators[0].horror,0)
})

test('07311 skull switches only at4 real in-play unflooded Yha-nthlei; nonYha and remote water do not fake threshold',()=>{
  const s=fixture('intoTheMaelstrom'),rt=scenarioRuntime(s,[])
  const inactive=Object.values(s.scenario.locations).filter(loc=>loc.traits?.includes("Y'ha-nthlei")&&!s.locations.some(l=>l.id===loc.id))
  for(const loc of inactive.slice(0,3))rt.place(loc.id)
  const yha=s.locations.filter(loc=>loc.traits?.includes("Y'ha-nthlei"))
  assert.ok(yha.length>=4)
  for(const loc of yha)createMechanicsApi(s).water.set(loc.id,2,{ignoreRestrictions:true})
  for(const loc of yha.slice(0,3))createMechanicsApi(s).water.set(loc.id,0,{ignoreRestrictions:true})
  assert.equal(run(s,['skull']).value,19)
  createMechanicsApi(s).water.set(yha[3].id,0,{ignoreRestrictions:true})
  assert.equal(run(s,['skull']).value,17)
})

// Main still adds real agenda-advance terminal side effect, original-actor !=
// lead choice, ignoredSymbolEffects with actual committed card, same-face
// cancelled occurrence vs surviving duplicate,0clues/0enemy and curse10/9
// finite-pool edges, and combined harm assignment to two separate assets.
