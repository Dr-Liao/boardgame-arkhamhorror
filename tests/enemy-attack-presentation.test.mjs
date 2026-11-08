import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fixture, enemy, asset } from './core-fixture.mjs'
import { enemyAttack, applyHarm, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction, requestChoice } from '../src/engine/resolution.js'
import { emitPresentation } from '../src/engine/presentation-events.js'
import { stateHash } from '../src/engine/replay.js'
import { viewEvents } from '../src/integration/observation.js'
import { enemyAttackStyle } from '../src/integration/enemy-attack-presentation.js'
import { ENEMY_ATTACK_STYLES } from '../content/presentation/enemy-attack-styles.js'
import { ENEMY_ATTACK_GROUPS, ENEMY_ATTACK_FAMILIES } from '../web/enemy-attack-themes.js'
import { publicSequence } from '../web/table-presentation.js'
import { azathothAttack } from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/behavior.js'

const cues = events => publicSequence(events)
function run(s,execute,select=()=>null) {
  const resolve=(current,_seat,_move,events)=>execute(current,events)
  const events=[...resolveTransaction(s,0,{action:'enemyAnimationTest'},resolve)]
  for(let i=0;s.pendingChoice;i++) {
    assert.ok(i<100)
    const c=s.pendingChoice, optionId=select(c)||['skip','self','done'].find(id=>c.options.some(o=>o.id===id))||c.options[0].id
    events.push(...resolveTransaction(s,c.seat,{action:'choose',choiceId:c.id,optionId},resolve))
  }
  return events
}
test('enemy presentation roster resolves aliases and all 23 special families to executable profiles',()=>{
  assert.equal(Object.keys(ENEMY_ATTACK_FAMILIES).length,23)
  const seen=new Set()
  for(const [code,profile] of Object.entries(ENEMY_ATTACK_STYLES)) {
    const resolved=enemyAttackStyle({code})
    assert.ok(Object.hasOwn(ENEMY_ATTACK_GROUPS,resolved.attackStyle),code)
    assert.equal(resolved.attackStyle,profile.group)
    if(profile.family){assert.equal(resolved.enemyFamily,profile.family);seen.add(profile.family)}
  }
  assert.equal(seen.size,23)
  assert.equal(enemyAttackStyle({code:'flyingPolyp',underlyingCard:'01001'}).attackStyle,'flying')
  assert.equal(enemyAttackStyle({code:'xreanimated'}).attackStyle,'melee')
  assert.equal(enemyAttackStyle({code:'06293',scenarioEnemyRole:'nyarlathotepTrueShape'}).enemyFamily,'nyarlathotep')
  assert.equal(enemyAttackStyle({code:'06293',scenarioEnemyRole:'nyarlathotepTrueShape'}).enemyVariant,'trueShape')
  assert.equal(enemyAttackStyle({code:'06347'}).enemyVariant,'leg-1')
  assert.equal(enemyAttackStyle({code:'06306'}).enemyVariant,'mask-1')
  assert.equal(enemyAttackStyle({code:'unknown'}).attackStyle,'uncertain')
})
for(const [damage,horror] of [[2,0],[0,2],[1,1],[0,0]])test(`incoming threat and actual placement ${damage}/${horror} remain separate`,()=>{
  const s=fixture();enemy(s,{damage,horror})
  const events=run(s,(s,e)=>enemyAttack(s,s.enemies[0],s.investigators[0],e))
  const threat=cues(events).filter(c=>c.kind==='attack'),harm=cues(events).filter(c=>c.kind==='enemyHarm')
  assert.equal(threat.length,1);assert.equal(threat[0].presentationStage,'threat')
  assert.equal(harm.length,damage+horror?1:0)
  if(harm.length){assert.deepEqual(harm[0].targets,[{seat:0,damage,horror}]);assert.equal(harm[0].tableState.investigators[0].damage,0)}
  assert.equal(s.investigators[0].damage,damage);assert.equal(s.investigators[0].horror,horror)
  assert.ok(!Object.keys(s).some(k=>/presentationOrigin|placements|attackStyle/.test(k)))
})
test('prevented attacks have no threat or harm; unrelated harm has no enemy attribution',()=>{
  const s=fixture(),en=enemy(s,{damage:2,attackProtection:{0:s.round}}),events=[]
  assert.equal(enemyAttack(s,en,s.investigators[0],events),false)
  assert.equal(cues(events).filter(c=>['attack','enemyHarm'].includes(c.kind)).length,0)
  applyHarm(s,s.investigators[0],1,0,events,true)
  assert.equal(cues(events).filter(c=>c.kind==='enemyHarm').length,0)
})
test('all attack entry kinds, repeated instances and sleeping forms retain presentation boundaries',()=>{
  for(const kind of ['enemy','opportunity','retaliate','alert','effect']) {
    const s=fixture('01001',2);enemy(s,{damage:1,horror:0})
    const events=run(s,(s,e)=>{
      enemyAttack(s,s.enemies[0],s.investigators[0],e,null,{kind})
      enemyAttack(s,s.enemies[0],s.investigators[1],e,null,{kind})
    })
    const attacks=cues(events).filter(c=>c.kind==='attack'),harm=cues(events).filter(c=>c.kind==='enemyHarm')
    assert.equal(attacks.length,2,kind);assert.equal(harm.length,2,kind)
    assert.deepEqual(harm.map(c=>c.targets[0].seat),[0,1])
    assert.ok(attacks.every(c=>c.attackKind===kind))
  }
  for(const code of ['07292a','07330a','07331a']) {
    const s=fixture(),en=enemy(s,{code,originalCode:code,damage:3,horror:3}),events=[]
    assert.equal(enemyAttack(s,en,s.investigators[0],events),false,code)
    assert.equal(cues(events).filter(c=>['attack','enemyHarm'].includes(c.kind)).length,0)
  }
})
test('actual asset assignment is captured before lethal discard, without private hand contents',()=>{
  const s=fixture();const a=asset(s,'01018');enemy(s,{damage:3,horror:0})
  const events=run(s,(s,e)=>enemyAttack(s,s.enemies[0],s.investigators[0],e),c=>c.options.find(o=>o.id===a.id||o.id===`asset:${a.id}`)?.id)
  const harm=cues(events).filter(c=>c.kind==='enemyHarm')
  assert.ok(harm.length)
  assert.ok(harm.flatMap(c=>c.targets).some(target=>target.assetId===a.id))
  assert.ok(harm[0].tableState.investigators[0].assets.some(asset=>asset.id===a.id))
  assert.ok(!s.investigators[0].assets.some(asset=>asset.id===a.id))
  assert.equal(harm.flatMap(c=>c.targets).reduce((n,t)=>n+t.damage,0),3)
  for(const cue of cues(viewEvents(events,1)).filter(c=>c.kind==='enemyHarm')) {
    assert.equal(cue.tableState.investigators[0].hand.length,0)
    assert.ok(cue.targets.every(t=>!('underlyingCard' in t)))
  }
})
test('presentation insertion preserves rule cursor and does not replay across serialized choices',()=>{
  const base=fixture(),states=[structuredClone(base),structuredClone(base)],outputs=[]
  for(const [index,s] of states.entries()) {
    const resolve=(s,_seat,_move,e)=>{
      const rule=text=>s._resolution.events.push({type:'info',text})
      rule('first')
      if(index)emitPresentation(s,e,{type:'presentation',kind:'enemyHarm',label:'first'})
      requestChoice(s,{kind:'test',seat:0,source:'animation-test',prompt:'continue',options:[{id:'ok',label:'OK'}]})
      if(index)emitPresentation(s,e,{type:'presentation',kind:'enemyHarm',label:'second'})
      rule('second')
    }
    const first=resolveTransaction(s,0,{action:'x'},resolve)
    outputs.push({first,resolve})
  }
  assert.equal(stateHash(states[0]),stateHash(states[1]))
  const resumed=JSON.parse(JSON.stringify(states[1])),q=resumed.pendingChoice
  const events=resolveTransaction(resumed,0,{action:'choose',choiceId:q.id,optionId:'ok'},outputs[1].resolve)
  assert.deepEqual(outputs[1].first.map(e=>e.text||e.label),['first','first'])
  assert.deepEqual(events.map(e=>e.text||e.label),['second','second'])
  assert.equal(resumed.continuation,null)
})
test('Azathoth global attack has a source without an enemy and preserves separate harm calls',()=>{
  const s=fixture();s.scenario.id='beforeTheBlackThrone'
  const events=run(s,(s,e)=>azathothAttack(s,scenarioRuntime(s,e),0))
  const threat=cues(events).find(c=>c.kind==='attack'),harm=cues(events).filter(c=>c.kind==='enemyHarm')
  assert.equal(threat.sourceKind,'global');assert.equal(threat.enemyFamily,'azathoth');assert.equal(threat.enemyId,undefined)
  assert.equal(harm.length,2);assert.equal(s.investigators[0].damage,3);assert.equal(s.investigators[0].horror,3)
})
test('all downloaded enemy audio files match provenance checksums and CC0 licenses',()=>{
  const sources=JSON.parse(fs.readFileSync(new URL('../web/audio/enemy-attack-sources.json',import.meta.url)))
  assert.equal(sources.length,7)
  for(const source of sources){const b=fs.readFileSync(new URL('../web/audio/'+source.file,import.meta.url));assert.equal(source.license,'CC0-1.0');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),source.sha256);assert.equal(b.subarray(0,4).toString(),'OggS')}
})
