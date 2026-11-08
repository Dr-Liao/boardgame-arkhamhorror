import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { fixture, enemy, asset } from './core-fixture.mjs'
import { executeDescriptor, applyMove } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { ATTACK_THEMES } from '../web/attack-themes.js'
import { ATTACK_STYLE_OVERRIDES } from '../content/presentation/attack-styles.js'
import { attackStyle } from '../src/integration/attack-style.js'
import { publicSequence } from '../web/table-presentation.js'

// Frozen P1 scope, including upgrades as separate implementations.
const P1=['04266','05013','06201','07302','02014','02115','02263','04204','04305','05117','05190','05191','06280','06282','07014','02112','04276','04310','05118','05192','05193','06018','07153','07159','07193']
const presentation = events => events.map(e=>e.presentation||e)
function run(state, execute, choose=()=>null) {
  const events=[...resolveTransaction(state,0,{action:'themeTest'},execute)]
  for(let i=0;state.pendingChoice;i++) {
    assert.ok(i<150,`choice loop ${state.pendingChoice.source}`)
    const c=state.pendingChoice
    const optionId=choose(c)??['done','skip','self','normal','no','focus','fight'].find(id=>c.options.some(o=>o.id===id))??c.options[0].id
    events.push(...resolveTransaction(state,c.seat,{action:'choose',choiceId:c.id,optionId},execute))
  }
  return events
}

test('all 25 P1 implementations publish their themed style through actual attack descriptors, hit and miss',()=>{
  assert.equal(P1.length,25)
  for(const code of P1)for(const success of [true,false]) {
    const s=fixture(),foe=enemy(s,{health:40})
    const inv=s.investigators[0]
    inv.willpower=10;inv.combat=10;inv.agility=10;inv.intellect=10
    s.chaosBag=[success?'0':'autofail']
    const source=ALL_CARDS[code].type==='asset'?asset(s,code,{uses:8}):{code,id:code}
    const entry=registeredEntry(code)
    const descriptor=entry.abilities.find(d=>d.effect?.type==='fight'||d.countsAs==='fight')??entry.abilities.find(d=>d.kind==='played')
    assert.ok(descriptor,code)
    const events=run(s,(state,_seat,_move,e)=>{
      const owner=state.investigators[0],target=state.enemies.find(enemy=>enemy.id===foe.id)
      executeDescriptor(state,{inv:owner,source:owner.assets.find(a=>a.id===source.id)||source,
        descriptor:{...descriptor,code},context:{targetId:target.id},events:e,ignoreCosts:true,alreadyPaid:true})
    })
    const cues=presentation(events).filter(c=>c.kind==='attack'&&c.direction==='outgoing')
    assert.equal(cues.length,1,`${code}/${success}`)
    assert.equal(cues[0].weaponCode,code,`${code}: provenance lost`)
    assert.equal(cues[0].attackStyle,ATTACK_STYLE_OVERRIDES[code],code)
    assert.equal(cues[0].success,success,code)
    assert.ok(Object.hasOwn(ATTACK_THEMES,cues[0].attackStyle),code)
  }
})

test('source wiring also works through normal event play and paid bottle discard',()=>{
  for(const code of ['04266','06201','02115','05117','05190','05191']) {
    const s=fixture(),foe=enemy(s)
    let events=[]
    if(ALL_CARDS[code].type==='event') {
      s.investigators[0].hand=[code]
      events.push(...applyMove(s,0,{action:'play',cardId:code}))
    } else {
      const bottle=asset(s,code)
      events.push(...applyMove(s,0,{action:'ability',assetId:bottle.id,abilityIndex:1,targetId:foe.id}))
    }
    for(let i=0;s.pendingChoice;i++) {
      assert.ok(i<100)
      const c=s.pendingChoice,id=['done','skip','self','fight'].find(id=>c.options.some(o=>o.id===id))??c.options[0].id
      events.push(...applyMove(s,c.seat,{action:'choose',choiceId:c.id,optionId:id}))
    }
    const cue=presentation(events).find(c=>c.kind==='attack'&&c.direction==='outgoing')
    assert.equal(cue?.weaponCode,code)
    assert.equal(cue?.attackStyle,ATTACK_STYLE_OVERRIDES[code])
    if(code.startsWith('051'))assert.ok(!s.investigators[0].assets.some(a=>a.code===code))
  }
})

test('flamethrower placement follows only accepted allocation targets, not the initial highest-fight target',()=>{
  for(const spend of [true,false]) {
    const s=fixture(),a=enemy(s,{fight:2}),b=enemy(s,{fight:1}),gun=asset(s,'04305')
    let allocated=0
    const events=run(s,(state,_seat,_move,e)=>{
      const inv=state.investigators[0],source=inv.assets.find(a=>a.id===gun.id)
      executeDescriptor(state,{inv,source,descriptor:{...registeredEntry('04305').abilities[0],code:'04305'},events:e,ignoreCosts:true})
    },c=>{
      if(c.kind==='effect'&&c.options.some(o=>o.id==='spread'))return 'spread'
      if(c.kind==='assign-damage')return spend&&allocated++<2?b.id:'done'
      return null
    })
    const hits=presentation(events).filter(c=>c.kind==='directDamage')
    assert.equal(hits.length,spend?2:0)
    assert.ok(hits.every(c=>c.style==='flamethrower'&&c.targets[0].enemyId===b.id))
    assert.equal(s.enemies.find(e=>e.id===a.id).damageTaken,0)
    assert.equal(s.enemies.find(e=>e.id===b.id).damageTaken,spend?2:0)
    assert.equal(presentation(events).filter(c=>c.kind==='attack').length,0,'no speculative success cue before allocation')
  }
})

test('themed reprints retain public styles and fire placements coalesce without mutating event input',()=>{
  assert.equal(attackStyle({...ALL_CARDS['02115'],code:'reprint',originalCode:'reprint',duplicateOfCode:'02115'}),'flare')
  const c={type:'presentation',kind:'directDamage',style:'flamethrower',code:'04305',seat:0,location:'x',targets:[{enemyId:'a',damage:1}]}
  const events=[c,structuredClone(c),{...c,targets:[{enemyId:'b',damage:1}]}],before=structuredClone(events)
  const seq=publicSequence(events)
  assert.equal(seq.length,1)
  assert.deepEqual(seq[0].targets,[{enemyId:'a',damage:2},{enemyId:'b',damage:1}])
  assert.deepEqual(events,before)
})

test('non-attack branches of flare, bow and companions do not emit attack themes',()=>{
  for(const [code,index] of [['02115',0],['04204',1],['02014',1],['06282',1]]) {
    const s=fixture();enemy(s)
    const source=ALL_CARDS[code].type==='asset'?asset(s,code,{uses:0}):{code,id:code}
    const events=run(s,(state,_seat,_move,e)=>{
      const inv=state.investigators[0]
      executeDescriptor(state,{inv,source:inv.assets.find(a=>a.id===source.id)||source,
        descriptor:{...registeredEntry(code).abilities[index],code},events:e,ignoreCosts:true,alreadyPaid:true})
    },c=>code==='02115'&&c.options.some(o=>o.id==='ally')?'ally':null)
    assert.ok(!presentation(events).some(c=>c.kind==='attack'||c.kind==='directDamage'),code)
  }
})

test('P1 sampled media have intact hashes, Ogg headers and bundled CC0 licenses',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../web/audio/themed-attack-sources.json',import.meta.url),'utf8'))
  assert.equal(data.samples.length,11)
  for(const entry of data.samples) {
    const bytes=fs.readFileSync(new URL('../web/audio/'+entry.file,import.meta.url))
    assert.equal(bytes.subarray(0,4).toString(),'OggS')
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256)
    assert.match(fs.readFileSync(new URL('../web/audio/'+entry.licenseFile,import.meta.url),'utf8'),/Creative Commons Zero, CC0/)
  }
})
