import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fixture, enemy, asset, play, use } from './core-fixture.mjs'
import { damageEnemy, applyDamage, applyMove, executeDescriptor, campaignCardDrawReaction } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { withEffectSource } from '../src/engine/effect-provenance.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { DIRECT_DAMAGE_STYLES } from '../content/presentation/direct-damage-styles.js'
import { publicSequence } from '../web/table-presentation.js'
import { viewEvents } from '../src/integration/observation.js'

const cues = events => events.map(event => event.presentation || event).filter(event => event.kind === 'directDamage')
function finish(state, events, choose = () => null) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `choice loop ${state.pendingChoice.source}`)
    const c = state.pendingChoice
    const id = choose(c) ?? ['done','skip','self','normal'].find(id => c.options.some(o => o.id === id)) ?? c.options[0].id
    events.push(...applyMove(state, c.seat, { action:'choose',choiceId:c.id,optionId:id }))
  }
  return events
}
function run(state, execute, choose = () => null) {
  const events = [...resolveTransaction(state,0,{action:'presentationTest'},execute)]
  for(let i=0;state.pendingChoice;i++) {
    assert.ok(i<100)
    const c=state.pendingChoice
    const optionId=choose(c) ?? ['done','skip','self','normal'].find(id=>c.options.some(o=>o.id===id)) ?? c.options[0].id
    events.push(...resolveTransaction(state,c.seat,{action:'choose',choiceId:c.id,optionId},execute))
  }
  return events
}

test('P0: all 30 sources emit actual damage once with pre-lethal snapshot and public source', () => {
  assert.equal(Object.keys(DIRECT_DAMAGE_STYLES).length,30)
  for(const [code,style] of Object.entries(DIRECT_DAMAGE_STYLES)) {
    const state=fixture(), target=enemy(state,{health:1})
    const source=asset(state,code)
    const before=structuredClone(state)
    const events=run(state,(s,_seat,_move,e)=>withEffectSource(s,{kind:'playerCard',code,sourceId:source.id,controllerSeat:0},()=>{
      assert.equal(damageEnemy(s,s.enemies.find(enemy=>enemy.id===target.id),1,0,e),true)
    }))
    const direct=cues(events)
    assert.equal(direct.length,1,code)
    assert.equal(direct[0].code,code)
    assert.equal(direct[0].style,style)
    assert.equal(direct[0].assetId,source.id)
    assert.equal(direct[0].tableState.enemies.find(e=>e.id===target.id).damageTaken,0)
    assert.equal(direct[0].targets[0].damage,1)
    assert.equal(state.enemies.some(e=>e.id===target.id),false)
    const publicCue=cues(viewEvents(events,1))[0]
    assert.equal(publicCue.tableState.investigators[0].hand.length,0)
    assert.ok(!publicCue.tableState.investigators[0].deck.length)
    // Presentation must not persist provenance or damage-queue fields in state.
    assert.ok(Object.keys(state).every(key=>Object.hasOwn(before,key)))
  }
})

test('no damage cue for zero, negative, immune, absent target or unrelated attack source', () => {
  const state=fixture(), target=enemy(state), events=[]
  withEffectSource(state,{kind:'playerCard',code:'01018'},()=>{
    for(const amount of [0,-1]) assert.equal(damageEnemy(state,target,amount,0,events),false)
    target.global=true
    assert.equal(damageEnemy(state,target,1,0,events),false)
    delete target.global
    assert.equal(damageEnemy(state,{...target,id:'absent'},1,0,events),false)
  })
  withEffectSource(state,{kind:'playerCard',code:'03153'},()=>damageEnemy(state,target,1,0,events))
  assert.equal(cues(events).length,0,'existing storm attacks must not gain duplicate direct hits')
})

test('implemented reprint aliases reuse canonical feedback while retaining printed source code', () => {
  const state=fixture(),target=enemy(state),events=[]
  withEffectSource(state,{kind:'playerCard',code:'01518',sourceId:'reprint'},()=>damageEnemy(state,target,1,0,events))
  assert.equal(cues(events)[0]?.code,'01518')
  assert.equal(cues(events)[0]?.style,'impact')
})

test('legacy played damage and evade damage preserve their real source through choices', () => {
  for(const code of ['01052','01066','01069','03036']) {
    const state=fixture(), target=enemy(state,{exhausted:true}), source=code==='03036'?asset(state,code):null
    let events=source?[...applyMove(state,0,{action:'ability',assetId:source.id,abilityIndex:1})]:[...play(state,code)]
    finish(state,events)
    assert.equal(cues(events).length,1,code)
    assert.equal(cues(events)[0].code,code)
    assert.ok(state.enemies.find(e=>e.id===target.id).damageTaken>0)
    if(source) assert.equal(state.investigators[0].assets.some(a=>a.id===source.id),false)
  }
})

test('P0-A: actual damage descriptors retain provenance across every implemented source path', () => {
  const branchCards=new Set(['05273','05187','06032','07117','07226','04230'])
  for(const code of Object.keys(DIRECT_DAMAGE_STYLES).filter(code=>!branchCards.has(code))) {
    const state=fixture('01001',2), target=enemy(state,{exhausted:true,damage:code==='02153'?2:0})
    state.investigators[1].location=state.investigators[0].location
    if(code==='03152') {target.engagedSeat=null;state.investigators[0].engaged=[]}
    if(['02113','07268'].includes(code))enemy(state,{engagedSeat:null})
    if(code==='07268')target.damage=2
    if(code==='02153')state.chaosBag=['skull']
    if(code==='07162')state.chaosBag=['autofail']
    const source=ALL_CARDS[code].type==='asset'?asset(state,code):{code,id:code}
    if(code==='07262')state.chaos.sealed=Array.from({length:3},()=>({source:source.id,token:'bless'}))
    if(code==='07268')state.chaos.sealed=[{source:source.id,token:'curse'}]
    const entry=registeredEntry(code)
    const descriptor=code==='03036'?entry.abilities[1]
      :code==='07262'?entry.abilities.find(d=>d.kind==='free')
      :code==='05277'?entry.abilities.find(d=>d.kind==='played')
      :code==='07268'?entry.abilities.find(d=>d.kind==='action'):entry.abilities[0]
    const events=run(state,(s,_seat,_move,e)=>{
      const inv=s.investigators[0],foe=s.enemies.find(enemy=>enemy.id===target.id)
      const context={enemy:foe,seat:1,location:foe.location,targetId:foe.id}
      s._reaction={...context,when:code==='02113'?'attackFail':'enemyAttack',attackDamage:2}
      executeDescriptor(s,{inv,source:inv.assets.find(a=>a.id===source.id)||source,
        descriptor:{...descriptor,code},context,events:e,ignoreCosts:true,alreadyPaid:true})
      delete s._reaction
    },c=>{
      if(code==='05317')return c.kind==='discard'?'0':c.options.some(o=>o.id==='damage')?'damage':null
      if(code==='07262')return c.options.some(o=>o.id==='damage')?'damage':null
      if(code==='07268')return c.options.find(o=>o.id.startsWith('damage:'))?.id??null
      return null
    })
    assert.ok(cues(events).some(c=>c.code===code),`${code}: no damage cue from actual descriptor`)
    assert.ok(cues(events).filter(c=>c.code===code).every(c=>c.targets[0].damage>0),code)
  }
})

test('Ancient Stone legacy draw reaction uses the stone, not the drawing card; skip emits none', () => {
  for(const trigger of [true,false]) {
    const state=fixture(), target=enemy(state), stone=asset(state,'04230',{uses:5,usesType:'secrets'})
    const events=run(state,(s,_seat,_move,e)=>campaignCardDrawReaction(s,s.investigators[0],e,2),c=>c.source===stone.id?(trigger?'trigger':'skip'):null)
    assert.equal(cues(events).length,trigger?1:0)
    if(trigger) {
      assert.equal(cues(events)[0].code,'04230')
      assert.equal(cues(events)[0].assetId,stone.id)
      assert.equal(cues(events)[0].damage,2)
    }
    assert.equal(state.enemies.find(e=>e.id===target.id).damageTaken,trigger?2:0)
  }
})

test('grenade emits one grouped blast with actual enemies and other investigator; miss emits none', () => {
  for(const success of [true,false]) {
    const state=fixture('01001',2)
    state.investigators[1].location=state.investigators[0].location
    const a=enemy(state),b=enemy(state,{engagedSeat:null})
    const source=asset(state,'05273')
    state.chaosBag=[success?'0':'autofail']
    const events=finish(state,[...use(state,source,{targetId:a.id})])
    const direct=cues(events)
    assert.equal(direct.length,success?3:0)
    if(success) {
      assert.ok(!events.some(e=>(e.presentation||e).kind==='attack'),'zero standard damage must not show an extra default attack')
      assert.deepEqual(direct.flatMap(c=>c.targets).map(t=>t.enemyId??`seat:${t.seat}`),[a.id,b.id,'seat:1'])
      assert.equal(state.investigators[0].damage,0)
      assert.equal(state.investigators[1].damage,2)
      assert.ok(publicSequence(events).some(c=>c.style==='blast'))
    } else assert.ok(events.some(e=>(e.presentation||e).kind==='attack'&&(e.presentation||e).success===false))
  }
})

test('Thompson keeps one firearm attack and emits only the optional secondary hit', () => {
  for(const secondary of [true,false]) {
    const state=fixture(),a=enemy(state),b=enemy(state,{engagedSeat:null}),source=asset(state,'05187')
    const events=finish(state,[...use(state,source,{targetId:a.id})],c=>c.source==='05187'?(secondary?b.id:'skip'):null)
    assert.equal(events.filter(e=>(e.presentation||e).kind==='attack').length,1)
    assert.equal(cues(events).length,secondary?1:0)
    if(secondary)assert.equal(cues(events)[0].targets[0].enemyId,b.id)
  }
})

test('blast feedback includes damage redirected to a diving suit, including full absorption', () => {
  for(const amount of [1,2]) {
    const state=fixture('01001',2),suit=asset(state,'07338',{},1)
    const events=run(state,(s,_seat,_move,e)=>withEffectSource(s,{kind:'playerCard',code:'05273',controllerSeat:0},()=>applyDamage(s,s.investigators[1],amount,e)))
    assert.equal(cues(events).length,1)
    assert.equal(cues(events)[0].seat,0)
    assert.equal(cues(events)[0].targets[0].seat,1)
    assert.equal(cues(events)[0].damage,amount)
    assert.equal(state.investigators[1].assets.find(a=>a.id===suit.id).damage,1)
    assert.equal(state.investigators[1].damage,amount-1)
  }
})

test('Zeal discarded branch and Armageddon curse damage emit hits, alternative rewards do not', () => {
  const zeal=fixture(),a=enemy(zeal),z=asset(zeal,'06032')
  const zealEvents=finish(zeal,[...use(zeal,z,{targetId:a.id})],c=>c.source==='06032'?'discard':null)
  assert.equal(cues(zealEvents)[0]?.code,'06032')
  for(const code of ['07117','07226'])for(const damage of [true,false]) {
    const state=fixture(),target=enemy(state),source=asset(state,code)
    state.chaosBag=['curse','0']
    state.rngState=0
    const events=finish(state,[...use(state,source,{targetId:target.id})],c=>c.options.some(o=>o.id===`enemy:${target.id}`)?(damage?`enemy:${target.id}`:'charge'):null)
    assert.equal(cues(events).length,damage?1:0,`${code}/${damage}`)
    assert.equal(events.filter(e=>(e.presentation||e).kind==='attack').length,1)
  }
})

test('blast grouping preserves inputs and ends at checkpoints; new CC0 media have Ogg headers and licenses', () => {
  const cue={type:'presentation',kind:'directDamage',style:'blast',code:'05273',seat:0,location:'study',targets:[{enemyId:'a',damage:2}]}
  const events=[{...cue,seq:1},{...cue,seq:2,targets:[{enemyId:'b',damage:2}]},{type:'presentation',kind:'checkpoint',seq:3},{...cue,seq:4}]
  const saved=structuredClone(events),seq=publicSequence(events)
  assert.equal(seq.length,3)
  assert.equal(seq[0].targets.length,2)
  assert.equal(seq[0].eventSeq,1)
  assert.deepEqual(events,saved)
  for(const name of ['impact','bite','glass','arcane']) {
    const file=new URL(`../web/audio/direct-${name}.ogg`,import.meta.url)
    assert.equal(fs.readFileSync(file).subarray(0,4).toString(),'OggS')
  }
  assert.match(fs.readFileSync(new URL('../web/audio/LICENSE-Kenney-impact.txt',import.meta.url),'utf8'),/Creative Commons Zero, CC0/)
})
