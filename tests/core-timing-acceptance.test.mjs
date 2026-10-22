import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

for(const code of ['01001','01003','01004','01005']) test(`Core ${code} 旧印效果`,()=>{
  const s=fixture(code); s.chaosBag=['eldersign']; s.locations[0].clues=3
  const inv=s.investigators[0]; inv.intellect=1; inv.horror=2; s.locations[0].shroud=3
  if(code==='01005') asset(s,'01014')
  move(s,{action:'investigate'}); settle(s)
  assert.equal(s.investigators[0].clues,1)
  if(code==='01003') assert.equal(s.investigators[0].resources,32)
})

test('Core 01002 黛西旧印：检定失败不抽；成功后每控制一本书可抽 1（可选）',()=>{
  // 失败：即使控制书籍也不能抽牌，也不应出现旧印选择窗口。
  const fail=fixture('01002'); fail.chaosBag=['eldersign']; fail.investigators[0].intellect=0; fail.locations[0].shroud=3
  asset(fail,'01031'); asset(fail,'01035'); move(fail,{action:'investigate'}); answer(fail,'done'); settle(fail)
  assert.equal(fail.investigators[0].hand.length,0)
  assert.notEqual(fail.pendingChoice?.source,'daisyElderSign')
  for(const draw of [false,true]) {
    const s=fixture('01002'); s.chaosBag=['eldersign']; s.investigators[0].intellect=5
    s.locations[0].shroud=1; s.locations[0].clues=3
    asset(s,'01031'); asset(s,'01035'); s.investigators[0].hand=[]
    move(s,{action:'investigate'}); answer(s,'done')
    assert.equal(s.pendingChoice.source,'daisyElderSign')
    answer(s,draw?'trigger':'skip'); settle(s)
    assert.equal(s.investigators[0].hand.length,draw?2:0)
  }
})

test('Core 01003 奥图尔花两资源获得一次额外行动，同轮不能重复',()=>{
  const s=fixture('01003'); move(s,{action:'freeAction'}); settle(s)
  assert.equal(s.investigators[0].resources,28); assert.equal(s.investigators[0].actionsLeft,21)
  assert.ok(validateMove(s,0,{action:'freeAction'}))
})

test('Core 01009 死灵之书占用手槽并强制替换，旧印变失败，移走恐惧不能分配给盟友',()=>{
  const s=fixture('01002'); asset(s,'01086'); asset(s,'01087'); s.investigators[0].deck=['01009']
  move(s,{action:'draw'}); assert.equal(s.pendingChoice.kind,'assetReplacement'); settle(s)
  assert.equal(s.investigators[0].assets.length,1); assert.equal(s.investigators[0].threat[0].counters,3)
  asset(s,'01032'); s.chaosBag=['eldersign']; move(s,{action:'investigate'}); settle(s)
  assert.equal(s.investigators[0].clues,0)
  const id=s.investigators[0].threat[0].id
  for(let i=0;i<3;i++) {move(s,{action:'purgeThreat',threatId:id}); settle(s)}
  assert.equal(s.investigators[0].horror,3); assert.ok(s.investigators[0].discard.includes('01009'))
})

test('Core 01007 掩盖罪证可替代发现线索，地点与个人线索不改变',()=>{
  const s=fixture(); s.investigators[0].deck=['01007']; move(s,{action:'draw'}); settle(s)
  const before=s.locations[0].clues; move(s,{action:'investigate'}); answer(s,'done'); answer(s,'remove'); settle(s)
  assert.equal(s.locations[0].clues,before); assert.equal(s.investigators[0].clues,0); assert.equal(s.investigators[0].threat[0].counters,2)
})

for(const code of ['01012','01046','01073']) test(`Core ${code} 反应奖励与横置费用`,()=>{
  const s=fixture(); const a=asset(s,code)
  if(code==='01012') { play(s,'01060'); answer(s,'trigger') }
  if(code==='01046') { const e=enemy(s); s.investigators[0].agility=5; move(s,{action:'evade',enemyId:e.id}); answer(s,'done'); answer(s,'trigger') }
  if(code==='01073') { s.investigators[0].discard=['01086']; s.investigators[0].intellect=6; move(s,{action:'investigate'}); answer(s,'done'); answer(s,'trigger') }
  settle(s,c=>c.kind==='search'?c.options.find(o=>o.id!=='skip')?.id:null)
  assert.equal(s.investigators[0].hand.length,1)
  if(code!=='01012') assert.ok(s.investigators[0].assets.find(x=>x.id===a.id).exhausted)
})

test('Core 01041 伊察姆纳圆盘弃置新生成的非精英，不按击败触发奖励',()=>{
  const s=fixture(); asset(s,'01041'); s.encounterDeck=['youngDeepOne']; play(s,'01064'); answer(s,'trigger'); settle(s)
  assert.equal(s.enemies.length,0); assert.equal(s.investigators[0].horror,0); assert.equal(s.investigators[0].clues,2)
  assert.ok(s.encounterDiscard.includes('youngDeepOne')); assert.ok(s.investigators[0].discard.includes('01041'))
})

test('Core 01063 新晋术士只搜索前三张法术，横置并保留毁灭',()=>{
  const s=fixture(); play(s,'01063'); settle(s); s.investigators[0].deck=['01060','01088','01086','01065']
  use(s,s.investigators[0].assets[0]); assert.equal(s.pendingChoice.kind,'search')
  assert.ok(!s.pendingChoice.options.some(o=>o.label.includes('皱缩')))
  answer(s,s.pendingChoice.options.find(o=>o.id!=='skip').id); settle(s)
  assert.deepEqual(s.investigators[0].hand,['01065']); assert.equal(s.investigators[0].assets[0].doom,1)
})

for(const code of ['01080','01084']) test(`Core ${code} 运气好只改变自己的失败检定，并结算升级抽牌`,()=>{
  const s=fixture('01001',2); s.investigators[0].hand=[code]; s.investigators[1].hand=[code]; s.chaosBag=['-2']
  move(s,{action:'investigate'}); answer(s,'done'); assert.equal(s.pendingChoice.seat,0); answer(s,'0'); settle(s)
  assert.equal(s.investigators[0].clues,1); assert.equal(s.investigators[0].resources,29)
  assert.equal(s.investigators[0].hand.length,code==='01084'?1:0); assert.deepEqual(s.investigators[1].hand,[code])
})

test('Core 01056 孤注一掷翻转本次负数标记的修正',()=>{
  const s=fixture(); s.investigators[0].hand=['01056']; s.investigators[0].intellect=1; s.chaosBag=['-2']
  move(s,{action:'investigate'}); answer(s,'done'); answer(s,'0'); settle(s)
  assert.equal(s.investigators[0].clues,1); assert.equal(s.investigators[0].resources,28)
})

test('Core 01079 看看我发现了什么失败两点可用，失败三点不能触发',()=>{
  for(const penalty of [-3,-4]) {
    const s=fixture(); s.investigators[0].hand=['01079']; s.chaosBag=[String(penalty)]
    move(s,{action:'investigate'}); answer(s,'done')
    if(penalty===-3) {answer(s,'0'); settle(s); assert.equal(s.investigators[0].clues,2)}
    else {settle(s); assert.equal(s.investigators[0].clues,0); assert.deepEqual(s.investigators[0].hand,['01079'])}
  }
})

test('Core 01083 千钧一发将躲避的非精英洗回遭遇牌库',()=>{
  const s=fixture(); const e=enemy(s); s.investigators[0].hand=['01083']; s.investigators[0].agility=5
  move(s,{action:'evade',enemyId:e.id}); answer(s,'done'); answer(s,'0'); settle(s)
  assert.equal(s.enemies.length,0); assert.ok(s.encounterDeck.includes('ghoulMinion')); assert.ok(!s.encounterDiscard.includes('ghoulMinion'))
})

test('Core 01085 生存意志在本回合跳过抽标记，下回合恢复',()=>{
  const s=fixture(); s.chaosBag=['autofail']; play(s,'01085'); settle(s)
  move(s,{action:'investigate'}); settle(s); assert.equal(s.investigators[0].clues,1)
  move(s,{action:'endTurn'}); settle(s); move(s,{action:'investigate'}); settle(s)
  assert.equal(s.investigators[0].clues,1)
})

test('Core 01071 石像选择其中一个标记、归还两个标记，最后充能后弃置',()=>{
  const s=fixture(); const a=asset(s,'01071',{uses:1}); s.chaosBag=['0','autofail']
  move(s,{action:'investigate'}); answer(s,'done'); answer(s,'trigger')
  const option=s.pendingChoice.options.find(o=>o.label==='0'); assert.ok(option); answer(s,option.id); settle(s)
  assert.equal(s.investigators[0].clues,1); assert.deepEqual([...s.chaosBag].sort(),['0','autofail'])
  assert.ok(s.investigators[0].discard.includes(a.code))
})

test('Core 01074 球棒在攻击结算结束后因骷髅弃置',()=>{
  const s=fixture(); const a=asset(s,'01074'); const e=enemy(s); s.chaosBag=['skull']
  use(s,a,{targetId:e.id}); settle(s)
  assert.equal(s.enemies[0].damageTaken,2); assert.ok(s.investigators[0].discard.includes(a.code))
})

for(const code of ['01060','01066','01069']) test(`Core ${code} 负面符号的恐惧及行动损失`,()=>{
  const s=fixture(); const e=enemy(s); s.chaosBag=['autofail']
  if(code==='01060') use(s,asset(s,code),{targetId:e.id}); else play(s,code)
  settle(s)
  assert.equal(s.investigators[0].horror,code==='01066'?0:1)
  assert.equal(s.investigators[0].actionsLeft,code==='01060'?19:18)
  assert.equal(s.enemies[0].damageTaken,0)
})

test('Core 01082 安奎娜承受恐惧并横置，将伤害转移给另一敌人但不转移恐惧',()=>{
  const s=fixture(); const a=asset(s,'01082'); enemy(s,{damage:2,horror:1}); const target=enemy(s,{engagedSeat:null})
  move(s,{action:'resource'}); answer(s,'trigger'); settle(s)
  assert.equal(s.enemies.find(e=>e.id===target.id).damageTaken,2)
  assert.equal(s.investigators[0].damage,0); assert.equal(s.investigators[0].horror,1)
  assert.ok(s.investigators[0].assets[0].exhausted); assert.equal(s.investigators[0].assets[0].horror,1)
})

for(const c of Object.values(ALL_CARDS).filter(c=>c.pack==='core' && c.type==='asset' && (c.health||c.sanity) && c.code!=='01117')) test(`Core ${c.code} 支援按印刷承伤容量被击败`,()=>{
  const s=fixture(); const field=c.health?'damage':'horror', n=c.health||c.sanity; const a=asset(s,c.code)
  enemy(s,{[field]:n}); move(s,{action:'resource'}); settle(s,c=>c.kind===`assign-${field}`?a.id:null)
  assert.ok(s.investigators[0].discard.includes(c.code)); assert.equal(s.investigators[0][field],0)
})
