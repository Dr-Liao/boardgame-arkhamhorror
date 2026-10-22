import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, legalMoves, validateMove } from './core-fixture.mjs'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

for(const difficulty of ['easy','standard','hard','expert']) {
  const hard=['hard','expert'].includes(difficulty)
  test(`Core 01104 ${difficulty} 异教徒失败恐惧与石板伤害`,()=>{
    const s=fixture('01005',1,{difficulty}); s.investigators[0].intellect=0
    s.chaosBag=hard?['cultist','0']:['cultist']; if(hard) s.rngState=0; move(s,{action:'investigate'}); settle(s)
    assert.equal(s.investigators[0].horror,hard?2:1)
    enemy(s,{engagedSeat:null,traits:['Ghoul']}); s.chaosBag=['tablet']; move(s,{action:'investigate'}); settle(s)
    assert.equal(s.investigators[0].damage,1); assert.equal(s.investigators[0].horror,hard?3:1)
  })
  test(`Core 01120 ${difficulty} 骷髅计毁灭包含支援，异教徒放毁灭、石板归还线索`,()=>{
    const s=fixture('01005',1,{difficulty}); s.scenario=structuredClone(SCENARIOS.theMidnightMasks)
    enemy(s,{engagedSeat:null,traits:['Cultist'],doom:2}); asset(s,'01063',{doom:1}); s.doom=1
    s.investigators[0].intellect=6; s.chaosBag=['skull']; move(s,{action:'investigate'}); settle(s)
    assert.ok(s.log.some(l=>l.includes(`${hard?2:4} vs 2`)))
    s.chaosBag=['cultist']; move(s,{action:'investigate'}); settle(s); assert.equal(s.enemies[0].doom,3)
    s.investigators[0].clues=3; s.investigators[0].intellect=0; s.locations[0].clues=1; s.chaosBag=['tablet']
    move(s,{action:'investigate'}); settle(s)
    assert.equal(s.investigators[0].clues,hard?0:2); assert.equal(s.locations[0].clues,hard?4:2)
  })
  test(`Core 01142 ${difficulty} 异教徒给最近敌人放毁灭、石板怪物惩罚`,()=>{
    const s=fixture('01005',1,{difficulty}); s.scenario=structuredClone(SCENARIOS.theDevourerBelow)
    enemy(s,{engagedSeat:null,traits:['Monster']}); s.investigators[0].intellect=6; s.chaosBag=['cultist']
    move(s,{action:'investigate'}); settle(s); assert.equal(s.enemies[0].doom,hard?2:1)
    s.locations[0].clues=2; s.chaosBag=['tablet']; move(s,{action:'investigate'}); settle(s)
    assert.equal(s.investigators[0].damage,1); assert.equal(s.investigators[0].horror,hard?1:0)
  })
}

for(const [scenario,code,trait,id] of [['theGathering','01104','Ghoul','ghoulMinion'],['theDevourerBelow','01142','Monster','youngDeepOne']]) test(`Core ${code} 困难骷髅失败后从遭遇弃牌搜索敌人并在检定结束后抽取`,()=>{
  const s=fixture('01005',1,{difficulty:'hard'}); s.scenario=structuredClone(SCENARIOS[scenario]); s.investigators[0].intellect=0
  s.encounterDeck=['dissonantVoices']; s.encounterDiscard=[id]; s.chaosBag=['skull']; move(s,{action:'investigate'}); settle(s)
  assert.ok(s.enemies.some(e=>e.code===id)); assert.ok(!s.encounterDiscard.includes(id)); assert.equal(s.skillTest,null)
})

test('Core 01102 银暮祭司攻击后放毁灭，达到阈值立即推进密谋',()=>{
  const s=fixture(); s.investigators[0].deck=['01102']; move(s,{action:'draw'}); settle(s)
  s.doom=2; move(s,{action:'resource'}); settle(s)
  assert.equal(s.agendaIndex,1); assert.equal(s.doom,0)
})

test('Core 01143 01169 场上毁灭计入密谋阈值，推进时仍保留',()=>{
  const s=fixture(); const threshold=s.agendas[0].doomThreshold
  enemy(s,{code:'acolyte',engagedSeat:null,doom:threshold-1})
  s.doom=1
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.agendaIndex,1)
  assert.equal(s.enemies.find(e=>e.code==='acolyte').doom,threshold-1,'推进密谋不清除场上毁灭')
})

test('Core 01105 全员空手时仍可选择随机弃掉 1 张手牌的分支',()=>{
  const s=fixture(); s.doom=2; for(const inv of s.investigators) inv.hand=[]
  play(s,'01013')
  let sawDiscard=false
  settle(s,(c)=>{ if(c.options?.some(o=>o.id==='discard')) { sawDiscard=true; return 'discard' } return null })
  assert.ok(sawDiscard); assert.equal(s.investigators[0].horror,0)
})

test('Core 01171 神秘咏唱无 cultist 时同时检索遭遇牌库与弃牌堆',()=>{
  const s=fixture(); s.scenario=structuredClone(SCENARIOS.theDevourerBelow); s.enemies=[]
  s.locations.push({ id:'emptySpot', name:'空旷地', shroud:1, clues:0, maxClues:0, revealed:false, connections:[] })
  s.encounterDeck=['mysteriousChanting']; s.encounterDiscard=['acolyte']
  play(s,'01064'); settle(s)
  assert.ok(s.enemies.some(e=>e.code==='acolyte'))
})

test('Core 01170 01179 密会巫师神话结束放毁灭，黑山羊幼崽轮末治疗',()=>{
  const s=fixture(); enemy(s,{code:'wizardOfTheOrder',engagedSeat:null,doom:0}); enemy(s,{code:'relentlessDarkYoung',engagedSeat:null,damageTaken:3})
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.enemies.find(e=>e.code==='wizardOfTheOrder').doom,1)
  assert.equal(s.enemies.find(e=>e.code==='relentlessDarkYoung').damageTaken,1)
})

test('Core 01172 夜魇使负数标记翻倍，但正数不变',()=>{
  for(const token of ['-2','+1']) {
    const s=fixture(); const e=enemy(s,{code:'huntingNightgaunt',evade:2}); s.investigators[0].agility=5; s.chaosBag=[token]
    move(s,{action:'evade',enemyId:e.id}); settle(s)
    assert.equal(!!s.enemies[0].exhausted,token==='+1')
  }
})

test('Core 01177 伊斯观察者攻击弃随机牌，无牌则增加伤害和恐惧',()=>{
  for(const hasCard of [true,false]) {
    const s=fixture('01005'); enemy(s,{code:'yithianObserver',damage:1,horror:1})
    if(hasCard) s.investigators[0].hand=['01088']
    move(s,{action:'resource'}); settle(s)
    assert.equal(s.investigators[0].damage,hasCard?1:2); assert.equal(s.investigators[0].horror,hasCard?1:2)
    if(hasCard) assert.ok(s.investigators[0].discard.includes('01088'))
  }
})

test('Core 01180 羊羔被击败先强制全地点恐惧，再开启击败反应',()=>{
  const s=fixture('01001',2); const e=enemy(s,{code:'goatSpawn',health:1})
  move(s,{action:'fight',enemyId:e.id}); answer(s,'done')
  assert.equal(s.pendingChoice.source,'rolandClue'); assert.deepEqual(s.investigators.map(i=>i.horror),[1,1])
  settle(s)
})

for(const [code,id,field,amount] of [['01138','hermanCollins','hand',4],['01139','peterWarren','clues',2],['01140','victoriaDevereux','resources',5]]) test(`Core ${code} 异教徒本地点谈判支付并进入胜利区`,()=>{
  const s=fixture(); const def=SCENARIOS.theMidnightMasks.enemies[id]; const e=enemy(s,{...def,engagedSeat:null,health:10})
  s.investigators[0].clues=3; s.investigators[0].hand=Array(4).fill('01088')
  const before=field==='hand'?4:s.investigators[0][field]
  move(s,{action:'parleyCultist',enemyId:e.id}); settle(s)
  assert.equal(field==='hand'?s.investigators[0].hand.length:s.investigators[0][field],before-amount)
  assert.ok(s.victoryDisplay.some(c=>c.code===id)); assert.equal(s.enemies.length,0)
})

test('Core 01141 露丝躲避后直接进入胜利区',()=>{
  const s=fixture(); const e=enemy(s,{...SCENARIOS.theMidnightMasks.enemies.ruthTurner,engagedSeat:0}); s.investigators[0].agility=9
  move(s,{action:'evade',enemyId:e.id}); settle(s)
  assert.equal(s.enemies.length,0); assert.ok(s.victoryDisplay.some(c=>c.code==='ruthTurner'))
})

test('Core 01178 力量交易两个分支只结算选定效果',()=>{
  for(const choice of ['horror','power']) {
    const s=fixture('01005'); s.encounterDeck=['offerOfPower']; play(s,'01064'); answer(s,choice); settle(s)
    assert.equal(s.investigators[0].horror,choice==='horror'?2:0)
    assert.equal(s.investigators[0].hand.length,choice==='power'?2:0); assert.equal(s.doom,choice==='power'?2:0)
  }
})

test('Core 01156 仪式地轮末补足每人两个线索但不减少已有线索',()=>{
  for(const count of [1,6]) {
    const s=fixture(); s.locations.push({...SCENARIOS.theDevourerBelow.locations.ritualSite,clues:count,revealed:true})
    move(s,{action:'endTurn'}); settle(s); assert.equal(s.locations.find(l=>l.id==='ritualSite').clues,Math.max(2,count))
  }
})

test('Core 01124 房屋每人每回合独立使用，食尸鬼祭司改在此生成',()=>{
  const s=fixture('01001',2); s.scenario=structuredClone(SCENARIOS.theMidnightMasks)
  s.locations.push({...s.scenario.locations.yourHouse,revealed:true,clues:2})
  for(const inv of s.investigators) inv.location='yourHouse'
  move(s,{action:'locationAbility',locationId:'yourHouse'}); settle(s)
  assert.ok(validateMove(s,0,{action:'locationAbility',locationId:'yourHouse'}))
  move(s,{action:'endTurn'}); settle(s); move(s,{action:'locationAbility',locationId:'yourHouse'}); settle(s)
  assert.equal(s.investigators[1].resources,31)
  s.encounterDeck=['ghoulPriest']; play(s,'01064'); settle(s)
  assert.equal(s.enemies[0].location,'yourHouse')
})
