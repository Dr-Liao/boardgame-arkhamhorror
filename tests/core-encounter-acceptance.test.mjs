import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, answer, settle, asset, enemy, play, use, validateMove } from './core-fixture.mjs'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { getStat } from '../src/engine/engine.js'

const enemies=Object.assign({},...Object.values(SCENARIOS).map(s=>s.enemies))
const treacheries=Object.assign({},...Object.values(SCENARIOS).map(s=>s.treacheries))
const locations=Object.assign({},...Object.values(SCENARIOS).map(s=>s.locations))

for(const [id,def] of Object.entries(enemies).filter(([,c])=>ALL_CARDS[c.originalCode]?.pack==='core')) test(`Core ${def.originalCode} ${id} 实际抽取、生成、属性和在场归属`,()=>{
  const s=fixture(); s.locations.push(...Object.values(locations).filter(l=>l.id!=='study').map(l=>({...l,revealed:true,clues:2,maxClues:2})))
  s.encounterDeck=[id]; play(s,'01064'); settle(s)
  const e=s.enemies.find(e=>e.code===id); assert.ok(e,id)
  const c=ALL_CARDS[def.originalCode]
  assert.equal(e.fight,c.fight); assert.equal(e.evade,c.evade); assert.equal(e.damage,c.damage); assert.equal(e.horror,c.horror)
  assert.equal(e.health,def.healthPerInvestigator || def.health+(def.healthPerPlayerBonus||0))
  assert.ok(!s.encounterDiscard.includes(id)); assert.equal(e.doom,def.onSpawnDoom||0)
  if(def.spawn) assert.equal(e.location,def.spawn)
  if(def.spawnAnyEmpty) assert.notEqual(e.location,s.investigators[0].location)
  if(id==='youngDeepOne') assert.equal(s.investigators[0].horror,1)
})

for(const code of ['01101','01102','01103']) test(`Core ${code} 敌人弱点入场交战、猎物仅为持有者`,()=>{
  const s=fixture(); s.investigators[0].deck=[code]; move(s,{action:'draw'}); settle(s)
  const e=s.enemies[0]; assert.equal(e.code,code); assert.equal(e.engagedSeat,0); assert.equal(e.bearerSeat,0); assert.equal(e.prey,'bearer'); assert.ok(e.hunter)
  if(code==='01103') {
    e.health=1; move(s,{action:'fight',enemyId:e.id}); settle(s)
    assert.equal(s.investigators[0].clues,0); assert.ok(s.investigators[0].discard.includes(code))
  }
})

for(const [code,field,amount] of [['01007','counters',3],['01009','counters',3],['01011','resources',0],['01098',null,0],['01099',null,0],['01100',null,0]]) test(`Core ${code} 抽取弱点进入威胁区域并初始化`,()=>{
  const s=fixture(); s.investigators[0].deck=[code]; move(s,{action:'draw'}); settle(s)
  const card=s.investigators[0].threat.find(c=>c.code===code); assert.ok(card)
  if(field) assert.equal(card[field],amount)
  if(code==='01098') assert.equal(getStat(s,s.investigators[0],'combat'),3)
  assert.equal(s.investigators[0].hand.length,0); assert.equal(s.investigators[0].discard.length,0)
})

test('Core 01096 01097 失忆选择保留一张、妄想症失去全部资源',()=>{
  for(const code of ['01096','01097']) {
    const s=fixture(); s.investigators[0].hand=['01088','01086','01087']; s.investigators[0].deck=[code]
    move(s,{action:'draw'}); settle(s)
    assert.ok(s.investigators[0].discard.includes(code))
    if(code==='01096') assert.equal(s.investigators[0].hand.length,1)
    else assert.equal(s.investigators[0].resources,0)
  }
})

for(const [id,stat,field,amount] of [['rottingRemains','willpower','horror',3],['graspingHands','agility','damage',3],['cryptChill','willpower','damage',2],['umordhothsWrath','willpower','horror',5]]) {
  for(const success of [true,false]) test(`Core ${treacheries[id].originalCode} ${id} ${success?'成功':'失败'}结算`,()=>{
    const s=fixture('01005'); s.investigators[0][stat]=9
    s.chaosBag=[success?'0':'autofail']; s.encounterDeck=[id]; play(s,'01064'); settle(s,c=>c.options.some(o=>o.id==='harm')?'harm':null)
    assert.equal(s.investigators[0][field],success?0:amount); assert.ok(s.encounterDiscard.includes(id))
  })
}

test('Core 01168 朦胧之雾不能叠加，成功夜盗也会移除并触发米兰',()=>{
  const s=fixture(); s.encounterDeck=['obscuringFog','obscuringFog']; play(s,'01064'); settle(s); play(s,'01064'); settle(s)
  assert.equal(s.locations[0].shroudMod,2); assert.equal(s.encounterDiscard.filter(c=>c==='obscuringFog').length,1)
  s.investigators[0].intellect=9; asset(s,'01033'); const a=asset(s,'01045'); const before=s.investigators[0].resources
  use(s,a); settle(s)
  assert.equal(s.locations[0].shroudMod,0); assert.equal(s.investigators[0].resources,before+4)
  assert.equal(s.encounterDiscard.filter(c=>c==='obscuringFog').length,2)
})

test('Core 01169 按卡号抽出时生成在无人地点并放置1点毁灭', () => {
  const s = fixture()
  s.locations.push({ ...s.locations[0], id: 'chapel', name: '礼拜堂' })
  s.encounterDeck = ['01169']
  s.encounterDiscard = []
  play(s, '01064')
  settle(s)
  const spawned = s.enemies.find(enemy => enemy.code === '01169')
  assert.ok(spawned, '祭司应入场')
  assert.equal(spawned.location, 'chapel', '应生成在无人地点，而不是抽牌者所在地点')
  assert.equal(spawned.engagedSeat, null)
  assert.equal(spawned.doom, 1, '入场后应在祭司上放置1个毁灭标记')
  assert.ok(!s.encounterDiscard.includes('01169'))
})

test('Core 01169 01170 无空地点则弃置，有敌人的地点不算空地点',()=>{
  for(const id of ['acolyte','wizardOfTheOrder']) {
    const s=fixture(); s.encounterDeck=[id]; play(s,'01064'); settle(s)
    assert.equal(s.enemies.length,0); assert.ok(s.encounterDiscard.includes(id))
    const t=fixture(); t.locations.push({...t.locations[0],id:'empty'}); enemy(t,{location:'empty',engagedSeat:null})
    t.encounterDeck=[id]; play(t,'01064'); settle(t); assert.equal(t.enemies.length,1); assert.ok(t.encounterDiscard.includes(id))
  }
})

test('Core 01171 神秘咏唱按路径选择最近异教徒且不会立即推进议程',()=>{
  const s=fixture(); s.locations[0].connections=['near']; s.locations.push({...s.locations[0],id:'near',connections:['far']},{...s.locations[0],id:'far',connections:[]})
  enemy(s,{id:'far-enemy',code:'acolyte',location:'far',engagedSeat:null,traits:['Cultist']})
  enemy(s,{id:'near-enemy',code:'acolyte',location:'near',engagedSeat:null,traits:['Cultist']})
  s.doom=2; s.encounterDeck=['mysteriousChanting']; play(s,'01064'); settle(s)
  assert.equal(s.enemies.find(e=>e.id==='near-enemy').doom,2); assert.equal(s.enemies.find(e=>e.id==='far-enemy').doom,undefined)
  assert.equal(s.agendaIndex,0)
})

test('Core 01135 追猎鬼影可以付线索，假面猎手禁止支付',()=>{
  for(const blocked of [false,true]) {
    const s=fixture(); s.investigators[0].clues=2; if(blocked) enemy(s,{code:'theMaskedHunter'})
    s.encounterDeck=['huntingShadow']; play(s,'01064')
    assert.equal(s.pendingChoice.options.some(o=>o.id==='clues'),!blocked)
    answer(s,blocked?'damage':'clues'); settle(s)
    assert.equal(s.investigators[0].damage,blocked?2:0)
  }
})

test('Core 01137 狼人每次借机攻击前治疗伤害',()=>{
  const s=fixture(); enemy(s,{code:'wolfManDrew',damageTaken:3})
  move(s,{action:'resource'}); settle(s); move(s,{action:'resource'}); settle(s)
  assert.equal(s.enemies[0].damageTaken,1)
})

for(const id of ['attic','cellar','unhallowedGround','graveyard']) test(`Core ${locations[id].originalCode} 进入地点强制效果与揭示`,()=>{
  const s=fixture(); s.locations[0].connections=[id]; s.locations.push({...locations[id],revealed:false,clues:0,maxClues:2})
  s.chaosBag=['autofail']; move(s,{action:'move',locationId:id}); settle(s,c=>c.options.some(o=>o.id==='horror')?'horror':null)
  assert.ok(s.locations.find(l=>l.id===id).revealed); assert.equal(s.locations.find(l=>l.id===id).clues,2)
  if(id==='attic') assert.equal(s.investigators[0].horror,1)
  if(id==='cellar') assert.equal(s.investigators[0].damage,1)
  if(id==='unhallowedGround') { assert.equal(s.investigators[0].damage,1); assert.equal(s.investigators[0].horror,1) }
  if(id==='graveyard') assert.equal(s.investigators[0].horror,2)
})

test('Core 01151 扭曲的道路失败不会移动、揭示目标或弃掉屏障',()=>{
  const s=fixture(); const l={...locations.twistingPaths,revealed:true,clues:1}; s.locations=[l,{...locations.mainPath,revealed:false,clues:0,maxClues:0}]
  s.investigators[0].location=l.id; play(s,'01038'); settle(s); s.chaosBag=['autofail']
  move(s,{action:'move',locationId:'mainPath'}); settle(s)
  assert.equal(s.investigators[0].location,l.id); assert.equal(s.locations[1].revealed,false); assert.ok(s.locations[0].barricade)
})

for(const [id,skill] of [['oldHouse','willpower'],['cliffside','agility'],['tangledThicket','combat']]) test(`Core ${locations[id].originalCode} 密林替代调查属性`,()=>{
  const s=fixture(); s.locations=[{...locations[id],revealed:true,clues:2}]; s.investigators[0].location=id; s.investigators[0][skill]=5
  move(s,{action:'investigate'}); assert.equal(s.skillTest.skill,skill); settle(s); assert.equal(s.investigators[0].clues,1)
})

for(const [id,index,check] of [['southside',1,s=>assert.ok(s.investigators[0].hand.includes('01018'))],['downtown',1,s=>assert.equal(s.investigators[0].horror,0)]]) test(`Core ${SCENARIOS.theMidnightMasks.locationVariants[id][index].originalCode} 地点变体主动效果`,()=>{
  const s=fixture(); const l={...locations[id],...SCENARIOS.theMidnightMasks.locationVariants[id][index],revealed:true,clues:1}
  s.locations=[l]; s.investigators[0].location=id; s.investigators[0].horror=3; s.investigators[0].deck=['01018']
  move(s,{action:'locationAbility',locationId:id}); settle(s,c=>c.kind==='search'?c.options.find(o=>o.id!=='skip').id:null); check(s)
})
