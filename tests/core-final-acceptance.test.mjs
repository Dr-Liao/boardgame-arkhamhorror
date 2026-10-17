import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, validateMove } from './core-fixture.mjs'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { getStat } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

test('Core 所有地点及随机变体的帷幕、线索和胜利点与印刷卡一致',()=>{
  for(const s of Object.values(SCENARIOS)) for(const [id,l] of Object.entries(s.locations)) {
    for(const variant of s.locationVariants?.[id] || [{}]) {
      const merged={...l,...variant}, card=ALL_CARDS[merged.originalCode]
      for(const [runtime,printed] of [['shroud','shroud'],['cluesPerInvestigator','clues'],['victory','victory']]) {
        assert.equal(merged[runtime]||0,card[printed]||0,`${merged.originalCode} ${runtime}`)
      }
    }
  }
})

test('Core 01127 01131 午夜假面实际随机布置使用变体数值并按人数放置线索',()=>{
  const seen=new Set()
  for(let n=0;n<10;n++) {
    const s=fixture('01001',2,{seed:'core-variants-'+n}); s.actIndex=2
    move(s,{action:'resource'}); answer(s,'r2'); settle(s)
    assert.equal(s.scenario.id,'theMidnightMasks')
    for(const id of ['southside','downtown']) {
      const l=s.locations.find(l=>l.id===id), card=ALL_CARDS[l.originalCode]
      seen.add(l.originalCode); assert.equal(l.shroud,card.shroud); assert.equal(l.maxClues,card.clues*2)
      assert.equal(l.victory||0,card.victory||0)
    }
  }
  assert.ok(seen.has('01127')); assert.ok(seen.has('01131'))
})

test('Core 01117 丽塔横置后仍给同地点队友战斗与怪物伤害加成，远处无加成',()=>{
  const s=fixture('01001',2); asset(s,'01117',{exhausted:true},1)
  assert.equal(getStat(s,s.investigators[0],'combat'),5)
  const e=enemy(s,{traits:['Monster']}); move(s,{action:'fight',enemyId:e.id}); settle(s)
  assert.equal(s.enemies[0].damageTaken,2)
  s.investigators[1].location='remote'; assert.equal(getStat(s,s.investigators[0],'combat'),4)
  move(s,{action:'fight',enemyId:e.id}); settle(s); assert.equal(s.enemies[0].damageTaken,3)
})

test('Core 01035 医学教科书检定失败伤害选定队友，不伤害使用者',()=>{
  const s=fixture('01001',2); const a=asset(s,'01035'); s.investigators[1].damage=2; s.chaosBag=['autofail']
  use(s,a); answer(s,'1'); settle(s)
  assert.equal(s.investigators[1].damage,3); assert.equal(s.investigators[0].damage,0)
})

test('Core 01053 投机取巧成功超出三点回手，否则弃置',()=>{
  for(const intellect of [3,4]) {
    const s=fixture(); s.investigators[0].intellect=intellect; s.investigators[0].hand=['01053']
    move(s,{action:'investigate'}); answer(s,'0'); answer(s,'done'); settle(s)
    assert.equal(s.investigators[0].hand.includes('01053'),intellect===4)
    assert.equal(s.investigators[0].discard.includes('01053'),intellect===3)
  }
})

test('Core 01061 窥视重排队友或遭遇顶三张，保留其余牌序并支付一次',()=>{
  for(const target of ['deck:1','encounter']) {
    const s=fixture('01001',2); const a=asset(s,'01061'); const initial=['01088','01086','01087','01090']
    if(target==='encounter') s.encounterDeck=[...initial]; else s.investigators[1].deck=[...initial]
    use(s,a); answer(s,target); const order=s.pendingChoice.options.find(o=>o.id==='5').cardCodes
    const restored=structuredClone(s); answer(s,'5'); answer(restored,'5'); settle(s); settle(restored)
    assert.deepEqual(s,restored)
    const result=target==='encounter'?s.encounterDeck:s.investigators[1].deck
    assert.deepEqual(result,[initial[0],...order.toReversed()]); assert.equal(s.investigators[0].assets[0].uses,2)
    assert.ok(s.investigators[0].assets[0].exhausted)
  }
})

test('Core 01121b 蒙面猎手在事件结算前入场会阻止发现线索和付线索谈判',()=>{
  const s=fixture(); s.encounterDeck=['theMaskedHunter']; play(s,'01064'); settle(s)
  assert.equal(s.investigators[0].clues,0)
  const target=enemy(s,{...SCENARIOS.theMidnightMasks.enemies.peterWarren,engagedSeat:null})
  s.investigators[0].clues=3
  assert.ok(validateMove(s,0,{action:'parleyCultist',enemyId:target.id}))
})

test('Core 01125 河岸城移动揭示、线索数量和调查使用真实地点定义',()=>{
  const s=fixture(); s.locations[0].connections=['rivertown']; s.locations.push({...SCENARIOS.theMidnightMasks.locations.rivertown,revealed:false,clues:0,maxClues:1})
  move(s,{action:'move',locationId:'rivertown'}); settle(s)
  const l=s.locations.find(l=>l.id==='rivertown'); assert.ok(l.revealed); assert.equal(l.clues,1)
  move(s,{action:'investigate'}); assert.equal(s.skillTest.difficulty,1); settle(s)
  assert.equal(s.investigators[0].clues,1)
})

test('Core 01136 错误指示失败按差值归还线索、成功不归还、无线索涌动',()=>{
  for(const token of ['0','-2','autofail']) {
    const s=fixture(); s.investigators[0].intellect=4; s.investigators[0].clues=3; s.locations[0].clues=0
    s.chaosBag=[token]; s.encounterDeck=['falseLead']; play(s,'01064'); settle(s)
    // Drawn to the Flame then discovers up to two of the returned clues.
    assert.equal(s.investigators[0].clues,token==='autofail'?2:3)
    assert.equal(s.locations[0].clues,token==='autofail'?1:0)
  }
  const s=fixture(); s.encounterDeck=['ancientEvils','falseLead']; play(s,'01064'); settle(s)
  assert.equal(s.doom,1); assert.ok(s.encounterDiscard.includes('falseLead'))
})

test('Core 01165 不谐之声阻止支援和事件，轮末弃掉后恢复打牌',()=>{
  const s=fixture(); s.encounterDeck=['dissonantVoices']; play(s,'01064'); settle(s)
  s.investigators[0].hand=['01086','01088']
  for(const cardId of s.investigators[0].hand) assert.ok(validateMove(s,0,{action:'play',cardId}))
  s.encounterDeck=['obscuringFog']; move(s,{action:'endTurn'}); settle(s)
  assert.ok(s.encounterDiscard.includes('dissonantVoices')); assert.equal(s.investigators[0].threat.length,0)
  assert.equal(validateMove(s,0,{action:'play',cardId:'01086'}),null)
})

test('Core 01166 远古恶魔达到阈值时立即推进议程并清除毁灭',()=>{
  const s=fixture(); s.doom=2; s.encounterDeck=['ancientEvils']; play(s,'01064'); settle(s)
  assert.equal(s.agendaIndex,1); assert.equal(s.doom,0); assert.ok(s.encounterDiscard.includes('ancientEvils'))
})

test('Core 01174 上锁的门阻止调查，破门失败保留、成功才弃置',()=>{
  for(const skill of ['combat','agility']) {
    const s=fixture(); s.encounterDeck=['lockedDoor']; play(s,'01064'); settle(s)
    assert.ok(s.locations[0].locked); assert.ok(validateMove(s,0,{action:'investigate'}))
    s.investigators[0][skill]=5; s.chaosBag=['autofail']; move(s,{action:'breakDoor',skill}); settle(s)
    assert.ok(s.locations[0].locked); s.chaosBag=['0']; move(s,{action:'breakDoor',skill}); settle(s)
    assert.ok(!s.locations[0].locked); assert.ok(s.encounterDiscard.includes('lockedDoor'))
  }
})
