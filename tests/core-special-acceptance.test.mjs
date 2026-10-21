import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, validateMove } from './core-fixture.mjs'
import { getStat, prepareInvestigator } from '../src/engine/engine.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

for (const [code, skills] of [['01017',['willpower','combat']],['01034',['intellect','agility']],['01049',['combat','agility']],['01062',['willpower','intellect']],['01077',['willpower','agility']]]) {
  for (const skill of skills) test(`Core ${code} 付费天赋 ${skill} 可重复支付并在跳过后停止`, () => {
    const s = fixture(); asset(s, code); s.locations[0].investigateSkill = skill
    const base = getStat(s,s.investigators[0],skill)
    move(s,{action:'investigate'}); answer(s,'pay'); answer(s,'pay'); answer(s,'skip'); settle(s)
    assert.equal(s.investigators[0].resources,28)
    assert.ok(s.log.some(l=>l.includes(`${base+2} vs`)))
  })
}

for (const code of ['01030','01040']) test(`Core ${code} 放大镜仅在智识调查加值`, () => {
  const s=fixture(); asset(s,code); move(s,{action:'investigate'})
  assert.equal(s.skillTest.value,4); settle(s)
  s.locations[0].investigateSkill='willpower'; move(s,{action:'investigate'})
  assert.equal(s.skillTest.value,3); settle(s)
  if(code==='01040') {
    const a=s.investigators[0].assets[0]; s.locations[0].clues=0; use(s,a); settle(s)
    assert.equal(s.investigators[0].assets.length,0); assert.ok(s.investigators[0].hand.includes(code))
  }
})

test('Core 01042 百科全书不同技能加成同时保留并在阶段结束移除',()=>{
  const s=fixture(); const a=asset(s,'01042'), b=asset(s,'01042')
  use(s,a); answer(s,'0'); settle(s); use(s,b); answer(s,'1'); settle(s)
  assert.equal(getStat(s,s.investigators[0],'willpower'),5)
  assert.equal(getStat(s,s.investigators[0],'intellect'),5)
  move(s,{action:'endTurn'}); settle(s)
  assert.equal(getStat(s,s.investigators[0],'willpower'),3)
  assert.equal(getStat(s,s.investigators[0],'intellect'),3)
})

test('Core 01042 百科全书对队友使用时由使用者选择技能',()=>{
  const s=fixture('01002',2); const a=asset(s,'01042')
  const userCombat=getStat(s,s.investigators[0],'combat')
  const teammateCombat=getStat(s,s.investigators[1],'combat')
  use(s,a); answer(s,'1')
  assert.equal(s.pendingChoice.kind,'effect')
  assert.equal(s.pendingChoice.seat,0)
  assert.deepEqual(s.pendingChoice.options.map(option=>option.label),['意志 +2','智识 +2','战斗 +2','敏捷 +2'])
  answer(s,'2'); settle(s)
  assert.equal(getStat(s,s.investigators[0],'combat'),userCombat)
  assert.equal(getStat(s,s.investigators[1],'combat'),teammateCombat+2)
})

test('Core 01038 屏障保留每张附属实例，任何调查员离开时全部弃置',()=>{
  const s=fixture(); s.locations.push({...s.locations[0],id:'destination',connections:['study']}); s.locations[0].connections=['destination']
  play(s,'01038'); settle(s); play(s,'01038'); settle(s)
  assert.equal(s.investigators[0].discard.length,0); assert.equal(s.locations[0].barricades.length,2)
  move(s,{action:'move',locationId:'destination'}); settle(s)
  assert.equal(s.investigators[0].discard.filter(c=>c==='01038').length,2); assert.equal(s.locations[0].barricade,undefined)
})

test('Core 01048 01054 里奥不同等级仍共享唯一限制',()=>{
  const s=fixture(); asset(s,'01048'); s.investigators[0].hand=['01054']
  assert.ok(validateMove(s,0,{action:'play',cardId:'01054'}))
})

test('Core 01048 里奥的行动加成不跨关卡残留，新关卡按本关阵容重算',()=>{
  // 上一关带着里奥·德·卢卡结束：新关卡准备调查员时资产会被清空，
  // 额外行动必须随之消失，否则本关再打出第二张就会变成 +2（实际 5 次行动）。
  const s=fixture('04001')
  const inv=s.investigators[0]
  inv.assets.push({id:'leo-de-luca',code:'01048',exhausted:false})
  inv.actionsLeft=4
  prepareInvestigator(s,inv,[],s.locations[0].id)
  const after=s.investigators[0]
  assert.equal(after.assets.some(a=>a.code==='01048'),false,'旧关卡资产应当已清空')
  assert.equal(after.actionsLeft,3,'上一关的额外行动不能带进新关卡')
})

for (const [code,resources,cards,clues] of [['01088',3,0,0],['01057',10,0,0],['01043',0,3,0],['01037',0,0,1]]) {
  test(`Core ${code} 事件结算收益与弃牌`,()=>{
    const s=fixture(); play(s,code); settle(s)
    const cost={ '01088':0,'01057':3,'01043':0,'01037':2 }[code]
    assert.equal(s.investigators[0].resources,30-cost+resources)
    assert.equal(s.investigators[0].hand.length,cards); assert.equal(s.investigators[0].clues,clues)
    assert.ok(s.investigators[0].discard.includes(code))
  })
}

test('Core 01052 偷袭对横置敌人造成两伤且不能选择准备敌人',()=>{
  const s=fixture(); const e=enemy(s,{exhausted:true}); play(s,'01052'); settle(s)
  assert.equal(s.enemies[0].damageTaken,2); s.enemies[0].exhausted=false; s.investigators[0].hand=['01052']
  assert.ok(validateMove(s,0,{action:'play',cardId:'01052'})); assert.equal(s.enemies[0].id,e.id)
})

test('Core 01024 炸药同时伤害地点的全部敌人与调查员',()=>{
  const s=fixture(); enemy(s); enemy(s); play(s,'01024'); settle(s)
  assert.deepEqual(s.enemies.map(e=>e.damageTaken),[3,3]); assert.equal(s.investigators[0].damage,3)
})

test('Core 01076 01078 自动躲避正确横置并解除交战',()=>{
  for(const code of ['01076','01078']) {
    const s=fixture(); enemy(s); enemy(s,{engagedSeat:null})
    if(code==='01076') {const a=asset(s,code); use(s,a)} else play(s,code)
    settle(s)
    assert.equal(s.enemies.filter(e=>e.exhausted).length,code==='01076'?1:2)
    assert.deepEqual(s.investigators[0].engaged,[]); assert.ok(s.investigators[0].discard.includes(code))
  }
})

test('Core 01087 手电筒消耗补给并降低调查难度，自动失败仍失败',()=>{
  const s=fixture(); const a=asset(s,'01087'); s.investigators[0].intellect=0; s.locations[0].shroud=2
  use(s,a); settle(s); assert.equal(s.investigators[0].clues,1)
  s.chaosBag=['autofail']; use(s,s.investigators[0].assets[0]); settle(s)
  assert.equal(s.investigators[0].clues,1); assert.equal(s.investigators[0].assets[0].uses,1)
})

test('Core 01058 禁忌知识横置并支付恐惧，最后资源取走后弃置',()=>{
  const s=fixture(); const a=asset(s,'01058',{uses:1}); use(s,a); settle(s)
  assert.equal(s.investigators[0].horror,1); assert.equal(s.investigators[0].resources,31)
  assert.ok(s.investigators[0].discard.includes('01058'))
})

test('Core 01045 夜盗的成功给予资源而不发现线索',()=>{
  const s=fixture(); const a=asset(s,'01045'); use(s,a); settle(s)
  assert.equal(s.investigators[0].resources,33); assert.equal(s.investigators[0].clues,0)
  assert.ok(s.investigators[0].assets[0].exhausted)
})

test('Core 01064 飞蛾扑火先结算遭遇再发现两个线索',()=>{
  const s=fixture(); s.encounterDeck=['rottingRemains']; s.chaosBag=['autofail']; play(s,'01064')
  assert.equal(s.investigators[0].clues,0); assert.equal(s.skillTest.source.code,'01163'); settle(s)
  assert.equal(s.investigators[0].horror,3); assert.equal(s.investigators[0].clues,2)
})

test('Core 01081 求生本能解除其余交战不会横置敌人，移动可拒绝',()=>{
  const s=fixture(); const e=enemy(s); enemy(s); s.investigators[0].agility=5; s.investigators[0].hand=['01081']
  move(s,{action:'evade',enemyId:e.id}); answer(s,'0'); answer(s,'done')
  settle(s,c=>c.source==='survivalInstinct.disengage'?'trigger':null)
  assert.equal(s.enemies.filter(e=>e.exhausted).length,1)
})

test('Core 01018 击败队友交战的敌人时奖励归实际伤害来源',()=>{
  const s=fixture('01001',2); const a=asset(s,'01018'); const e=enemy(s,{health:1,engagedSeat:1})
  use(s,a,{targetId:e.id}); assert.equal(s.pendingChoice.seat,0)
  answer(s,'trigger'); settle(s)
  assert.equal(s.investigators[0].clues,1); assert.equal(s.investigators[1].clues,0)
})

test('Core 01145 最终议程背面取代幕和议程，击败乌默尔多斯进入结局二',()=>{
  const s=fixture(); s.scenario=structuredClone(SCENARIOS.theDevourerBelow); s.campaign.scenarioIndex=2
  s.acts=structuredClone(s.scenario.acts); s.actIndex=2; s.agendas=structuredClone(s.scenario.agendas); s.agendaIndex=2
  s.locations=[{...s.scenario.locations.mainPath,revealed:true,clues:0}]; s.investigators[0].location='mainPath'
  s.doom=4; move(s,{action:'endTurn'}); settle(s)
  assert.equal(s.agendas[0].face,'back'); assert.equal(s.acts[0].objective.enemy,'umordhoth')
  assert.ok(validateMove(s,0,{action:'interruptRitual',skill:'willpower'}))
  const boss=s.enemies.find(e=>e.code==='umordhoth'); assert.ok(boss)
  boss.location='mainPath'; boss.damageTaken=boss.health-1; s.investigators[0].combat=20
  move(s,{action:'fight',enemyId:boss.id}); settle(s)
  assert.equal(s.campaign.scenarioResults.at(-1).resolution,'r2')
})
