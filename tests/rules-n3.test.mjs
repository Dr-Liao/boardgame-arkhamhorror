import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, legalMoves, decisionSeat } from '../src/engine/engine.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { totalDoom } from '../src/engine/rules-state.js'

const clone = value => JSON.parse(JSON.stringify(value))
function answer(state, optionId) {
  const choice = state.pendingChoice
  assert.ok(choice, '必须存在待决选择')
  const move = { action: 'choose', choiceId: choice.id, optionId }
  assert.equal(validateMove(state, choice.seat, move), null)
  return applyMove(state, choice.seat, move)
}
function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, '选择必须有限完成')
    const id = state.pendingChoice.kind === 'turnOrder' ? state.pendingChoice.options[0].id : ['done', 'skip', 'self'].find(id => state.pendingChoice.options.some(option => option.id === id))
    assert.ok(id, `需要显式答案：${state.pendingChoice.kind}`)
    answer(state, id)
  }
}
function fixture(code = '01001', count = 1) {
  const state = createGameState({ playerInvestigator: code, seed: 'n3-unit' }, Array.from({ length: count }, (_, seat) => ({ seat, name: `P${seat}` })))
  settle(state)
  for (const inv of state.investigators) { inv.hand = []; inv.deck = ['01088', '01089', '01090']; inv.actionsLeft = 3 }
  state.chaosBag = ['0']
  state.encounterDeck = ['dissonantVoices']
  state.encounterDiscard = []
  return state
}
function asset(state, code, extra = {}) {
  const object = { id: 'c' + ++state.instanceSeq.c, code, exhausted: false, ...extra }
  state.investigators[0].assets.push(object)
  return object
}

test('卡牌移动揭露地点、触发进入效果，恢复选择不重复放线索或扣行动',()=>{
  const state=fixture()
  const inv=state.investigators[0],from=state.locations.find(loc=>loc.id===inv.location)
  from.connections=['cellar'];from.barricade=true
  state.locations.push({...clone(SCENARIOS.theGathering.locations.cellar),id:'cellar',revealed:false,clues:0,maxClues:2})
  const burglar=asset(state,'01055')
  const start=inv.actionsLeft
  const events=applyMove(state,0,{action:'ability',assetId:burglar.id,abilityIndex:0})
  assert.equal(state.locations.find(loc=>loc.id==='cellar').revealed,true)
  assert.equal(state.locations.find(loc=>loc.id==='cellar').clues,2)
  assert.ok(events.some(e=>e.presentation?.kind==='location' && e.presentation.seat===0 && e.presentation.location==='cellar'))
  const resumed=clone(state)
  settle(resumed)
  assert.equal(resumed.investigators[0].location,'cellar')
  assert.equal(resumed.investigators[0].damage,1)
  assert.equal(resumed.investigators[0].actionsLeft,start-1)
  assert.equal(resumed.locations.find(loc=>loc.id===from.id).barricade,undefined)
  assert.equal(resumed.locations.find(loc=>loc.id==='cellar').clues,2)
  assert.equal(resumed.log.filter(line=>line.includes('「地窖」被揭示')).length,1)
})
function enemy(state, extra = {}) {
  const object = { id: 'e' + ++state.instanceSeq.e, code: 'ghoulMinion', name: '测试敌人', fight: 2, evade: 2, health: 10, damageTaken: 0, damage: 1, horror: 0, exhausted: false, location: state.investigators[0].location, engagedSeat: 0, ...extra }
  state.enemies.push(object)
  if (object.engagedSeat != null) state.investigators[object.engagedSeat].engaged.push(object.id)
  return object
}
function reject(state, move, pattern) {
  const before = JSON.stringify(state)
  assert.match(validateMove(state, decisionSeat(state), move), pattern)
  assert.throws(() => applyMove(state, decisionSeat(state), move), pattern)
  assert.equal(JSON.stringify(state), before)
}
function execute(state, move) {
  assert.equal(validateMove(state, decisionSeat(state), move), null, JSON.stringify(move))
  applyMove(state, decisionSeat(state), move)
}

test('N3 开手换牌先放一旁，确认前不补抽；恢复不会重换', () => {
  const state = createGameState({ playerInvestigator: '01001', seed: 'mulligan' }, [{ seat: 0 }])
  const original = [...state.investigators[0].hand]
  answer(state, '0')
  assert.equal(state.investigators[0].hand.length, 4)
  const restored = clone(state)
  answer(state, 'done')
  answer(restored, 'done')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.investigators[0].hand.length, 5)
  assert.ok(state.investigators[0].deck.includes(original[0]))
  assert.equal(state.investigators[0].actionsLeft, 3)
})

test('N3 书房不能撤退、零行动不能抽牌，非法执行完整不变', () => {
  const state = fixture()
  reject(state, { action: 'resign' }, /撤退/)
  state.investigators[0].actionsLeft = 0
  reject(state, { action: 'draw' }, /行动点/)
  assert.ok(!legalMoves(state).some(move => move.action === 'draw'))
})

test('N3 双行动威胁与恐惧额外行动成本先校验', () => {
  const state = fixture()
  state.investigators[0].threat = [{ id: 't1', code: '01098' }]
  state.investigators[0].actionsLeft = 1
  reject(state, { action: 'discardThreat', threatId: 't1' }, /行动点/)
  state.investigators[0].threat = [{ id: 't1', code: 'frozenInFear' }]
  const e = enemy(state)
  reject(state, { action: 'fight', enemyId: e.id }, /行动点/)
})

test('N3 资源不足、禁打牌及唯一资产全部支付前拒绝', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['01016']
  inv.resources = 0
  reject(state, { action: 'play', cardId: '01016' }, /资源/)
  inv.resources = 10
  inv.threat = [{ id: 't1', code: 'dissonantVoices' }]
  reject(state, { action: 'play', cardId: '01016' }, /禁止/)
  inv.threat = []
  inv.hand = ['01048']
  asset(state, '01048')
  reject(state, { action: 'play', cardId: '01048' }, /唯一/)
})

test('N3 地点减费被合法列表、校验和执行共同使用', () => {
  const state = fixture()
  const inv = state.investigators[0]
  state.locations.push({ ...SCENARIOS.theMidnightMasks.locations.easttown, revealed: true, clues: 0 })
  inv.location = 'easttown'
  inv.hand = ['01018']
  inv.resources = ALL_CARDS['01018'].cost - 2
  assert.ok(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01018'))
  execute(state, { action: 'play', cardId: '01018' })
  assert.equal(state.investigators[0].resources, 0)
  assert.equal(state.investigators[0].actionsLeft, 2)
})

test('N3 技能投入暂停后不抽标记，不默认投入或付天赋', () => {
  const state = fixture()
  state.investigators[0].hand = ['01090']
  const before = state.rngState
  execute(state, { action: 'investigate' })
  assert.equal(state.pendingChoice.kind, 'commit')
  assert.equal(state.rngState, before)
  assert.deepEqual(state.investigators[0].hand, ['01090'])
  answer(state, 'done')
  assert.deepEqual(state.investigators[0].hand, ['01090'])
  assert.equal(state.investigators[0].actionsLeft, 2)
  const next = fixture()
  asset(next, '01034')
  const resources = next.investigators[0].resources
  execute(next, { action: 'investigate' })
  assert.equal(next.pendingChoice.kind, 'boost')
  assert.equal(next.investigators[0].resources, resources)
  settle(next)
  assert.equal(next.investigators[0].resources, resources)
})

test('N3 求助后同地点队友投入切换回答座位，恢复后回到原行动者', () => {
  const state = fixture('01001', 2)
  state.investigators[1].hand = ['01090']
  execute(state, { action: 'investigate' })
  answer(state, 'help')
  assert.equal(state.pendingChoice.seat, 1)
  assert.equal(decisionSeat(state), 1)
  answer(state, '0')
  assert.equal(state.currentSeat, 0)
  assert.ok(state.investigators[1].discard.includes('01090'))
})

test('N3 未指定效果分支不能自动取首项，嵌套选择JSON恢复不重复支付', () => {
  const state = fixture()
  const original = EFFECTS['01088'].event
  try {
    EFFECTS['01088'].event = { type: 'chooseOne', options: [{ label: '外层', effect: { type: 'chooseOne', options: [{ label: '内层', effect: { type: 'gainResource', amount: 3 } }] } }] }
    state.investigators[0].hand = ['01088']
    const resources = state.investigators[0].resources
    execute(state, { action: 'play', cardId: '01088' })
    assert.equal(state.pendingChoice.kind, 'effect')
    answer(state, '0')
    const restored = clone(state)
    answer(state, '0')
    answer(restored, '0')
    assert.deepEqual(clone(state), restored)
    assert.equal(state.investigators[0].resources, resources - ALL_CARDS['01088'].cost + 3)
    assert.equal(state.investigators[0].actionsLeft, 2)
  } finally { EFFECTS['01088'].event = original }
})

test('N3 未实现原语拒绝且资源手牌日志完全不变', () => {
  const state = fixture()
  const original = EFFECTS['01088'].event
  try {
    EFFECTS['01088'].event = { type: 'unknown-effect' }
    state.investigators[0].hand = ['01088']
    reject(state, { action: 'play', cardId: '01088' }, /未实现/)
    assert.ok(!legalMoves(state).some(move => move.action === 'play' && move.cardId === '01088'))
  } finally { EFFECTS['01088'].event = original }
})

test('N3 借机攻击可分配给资产，恢复后行动只扣一次且上限不增加', () => {
  const state = fixture()
  const coat = asset(state, '01072')
  enemy(state)
  const max = state.investigators[0].maxHealth
  execute(state, { action: 'resource' })
  assert.equal(state.pendingChoice.kind, 'assign-damage')
  answer(state, coat.id)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].assets.find(item => item.id === coat.id).damage, 1)
  assert.equal(state.investigators[0].maxHealth, max)
  assert.equal(state.investigators[0].actionsLeft, 2)
  assert.equal(state.investigators[0].resources, 6)
})

test('攻击演出使用结算结果，命中、落空和报复按顺序只发出一次',()=>{
  for(const success of [true,false]) {
    const state=fixture(),target=enemy(state,{retaliate:true})
    state.chaosBag=[success?'0':'autofail']
    const events=applyMove(state,0,{action:'fight',enemyId:target.id})
    for(let i=0;state.pendingChoice;i++) {
      assert.ok(i<30)
      const id=['done','skip','self'].find(id=>state.pendingChoice.options.some(option=>option.id===id))
      events.push(...answer(state,id))
    }
    const attacks=events.map(e=>e.presentation||e).filter(e=>e.kind==='attack')
    assert.equal(attacks.length,success?1:2)
    assert.equal(attacks[0].direction,'outgoing');assert.equal(attacks[0].success,success)
    assert.equal(attacks[0].enemyId,target.id);assert.equal(attacks[0].damage,success?1:0)
    assert.equal(attacks[0].tableState.enemies[0].damageTaken,0,'出击时仍显示扣血前的敌人')
    if(!success){assert.equal(attacks[1].direction,'incoming');assert.equal(attacks[1].damage,1)}
    assert.equal(events.at(-1).kind,'checkpoint')
  }
})

test('敌军与借机攻击均提供受击演出，取消攻击不播放命中',()=>{
  for(const action of ['endTurn','resource']) {
    const state=fixture();enemy(state)
    const events=applyMove(state,0,{action})
    const attacks=events.map(e=>e.presentation||e).filter(e=>e.kind==='attack')
    assert.equal(attacks.length,1,action);assert.equal(attacks[0].direction,'incoming')
    assert.equal(attacks[0].tableState.investigators[0].damage,0)
  }
  const state=fixture();enemy(state);state.investigators[0].hand=['01023']
  const events=applyMove(state,0,{action:'resource'})
  assert.ok(state.pendingChoice)
  const trigger=state.pendingChoice.options.find(o=>o.id!=='skip')
  events.push(...answer(state,trigger.id))
  assert.equal(events.map(e=>e.presentation||e).filter(e=>e.kind==='attack').length,0)
})

test('N3 攻击不触发借机攻击，耗竭敌人也不借机攻击', () => {
  const state = fixture()
  const e = enemy(state)
  execute(state, { action: 'fight', enemyId: e.id })
  settle(state)
  assert.equal(state.investigators[0].damage, 0)
  state.enemies[0].exhausted = true
  execute(state, { action: 'resource' })
  assert.equal(state.investigators[0].damage, 0)
})

for (const [name, extras, multiple, expected] of [
  ['唯一交战', {}, false, 2],
  ['耗竭未交战', { engagedSeat: null, exhausted: true }, false, 1],
  ['两个交战', {}, true, 1],
]) test(`N3 大砍刀${name}仅按该武器行动结算`, () => {
  const state = fixture()
  const weapon = asset(state, '01020')
  const e = enemy(state, extras)
  if (multiple) enemy(state)
  execute(state, { action: 'ability', assetId: weapon.id, abilityIndex: 0, targetId: e.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === e.id).damageTaken, expected)
  assert.equal(state.investigators[0].damage, 0)
})

test('N3 手枪消耗一弹且零弹留场，普通攻击不叠加武器属性', () => {
  const state = fixture()
  const weapon = asset(state, '01016', { uses: 1, usesType: 'ammo' })
  const e = enemy(state)
  execute(state, { action: 'ability', assetId: weapon.id, abilityIndex: 0, targetId: e.id })
  settle(state)
  assert.equal(state.investigators[0].assets.find(item => item.id === weapon.id).uses, 0)
  assert.equal(state.enemies[0].damageTaken, 2)
  reject(state, { action: 'ability', assetId: weapon.id, abilityIndex: 0, targetId: e.id }, /成本/)
  execute(state, { action: 'fight', enemyId: e.id })
  settle(state)
  assert.equal(state.enemies[0].damageTaken, 3)
})

test('N3 搜索实际查看顶三张，合法回答后只加入所选牌', () => {
  const state = fixture()
  const book = asset(state, '01031')
  state.investigators[0].deck = ['01088', '01089', '01090', '01091']
  execute(state, { action: 'ability', assetId: book.id, abilityIndex: 0 })
  assert.equal(state.pendingChoice.kind, 'search')
  assert.equal(state.investigators[0].hand.length, 0)
  answer(state, '0')
  assert.deepEqual(state.investigators[0].hand, ['01089'])
  assert.equal(state.investigators[0].deck.length, 3)
  assert.ok(!state.log.some(line => line.includes('搜索') && line.includes(ALL_CARDS['01089'].nameZh)))
})

test('N3 获得个人线索后不会自动推进，共同支付逐座位恢复', () => {
  const state = fixture('01001', 2)
  state.investigators[0].clues = 1
  state.investigators[1].clues = 3
  state.clues = 4
  execute(state, { action: 'resource' })
  assert.equal(state.actIndex, 0)
  execute(state, { action: 'advanceAct' })
  assert.equal(state.pendingChoice.kind, 'payment')
  answer(state, '1')
  assert.equal(state.pendingChoice.seat, 1)
  const restored = clone(state)
  answer(state, '3')
  answer(restored, '3')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.actIndex, 1)
  assert.equal(state.clues, 0)
  assert.deepEqual(state.investigators.map(inv => inv.clues), [0, 0])
})

test('共同线索可跨轮分摊，至少支付一个，JSON恢复不重复扣除且付清后才推进',()=>{
  const state=fixture('01001',2)
  state.investigators.forEach(inv=>{inv.clues=5});state.clues=10
  execute(state,{action:'advanceAct'})
  for(const [index,seat] of [0,1,0,1].entries()){
    assert.equal(state.actIndex,0)
    assert.equal(state.pendingChoice.seat,seat)
    assert.deepEqual(state.pendingChoice.payment,{required:4,remaining:4-index,paid:index,round:Math.floor(index/2)+1,min:1,max:4-index,available:5-Math.floor(index/2)})
    assert.equal(state.pendingChoice.options[0].id,'1')
    reject(state,{action:'choose',choiceId:state.pendingChoice.id,optionId:'0'},/选项/)
    reject(state,{action:'choose',choiceId:state.pendingChoice.id,optionId:String(5-index)},/选项/)
    const restored=clone(state)
    answer(state,'1');answer(restored,'1')
    assert.deepEqual(clone(state),restored)
  }
  assert.equal(state.actIndex,1)
  assert.deepEqual(state.investigators.map(inv=>inv.clues),[3,3])
  assert.equal(state.clues,6)
})

test('共同线索轮询跳过零线索席位，耗尽后也不再询问',()=>{
  const state=fixture('01001',3)
  state.investigators.forEach((inv,index)=>{inv.clues=[0,1,5][index]});state.clues=6
  execute(state,{action:'advanceAct'})
  for(const seat of [1,2,2,2,2,2]){
    assert.equal(state.pendingChoice.seat,seat)
    answer(state,'1')
  }
  assert.equal(state.actIndex,1)
  assert.equal(state.clues,0)
  assert.deepEqual(state.investigators.map(inv=>inv.clues),[0,0,0])
})

test('N3 集结幕二限制走廊贡献和轮末窗口', () => {
  const state = fixture('01001', 2)
  state.actIndex = 1
  state.investigators[0].location = 'hallway'
  state.investigators[0].clues = 2
  state.investigators[1].clues = 4
  state.clues = 6
  state.locations.push({ ...SCENARIOS.theGathering.locations.hallway, revealed: true, clues: 0 })
  reject(state, { action: 'advanceAct' }, /窗口/)
  execute(state, { action: 'resource' })
  assert.equal(state.actIndex, 1)
  assert.equal(state.clues, 6)
})

test('N3 在场毁灭参与阈值，议程推进清除各区域毁灭', () => {
  const state = fixture()
  const threshold = state.agendas[0].doomThreshold
  enemy(state, { engagedSeat: null, exhausted: true, doom: threshold - 1 })
  asset(state, '01072', { doom: 1 })
  assert.equal(totalDoom(state), threshold)
  execute(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'agenda')
  answer(state, 'horror')
  settle(state)
  assert.equal(state.agendaIndex, 1)
  assert.equal(totalDoom(state), 0)
})

test('N3 地点进入时揭示且再次进入不重复补充线索', () => {
  const state = fixture()
  state.investigators[0].clues = 2
  state.clues = 2
  execute(state, { action: 'advanceAct' })
  answer(state, '2')
  assert.equal(state.locations.some(loc => loc.id === 'attic'), true)
  assert.equal(state.investigators[0].location, 'hallway')
  execute(state, { action: 'move', locationId: 'attic' })
  settle(state)
  assert.equal(state.locations.find(loc => loc.id === 'attic').revealed, true)
  const max = state.locations.find(loc => loc.id === 'attic').clues
  state.locations.find(loc => loc.id === 'attic').clues = max - 1
  execute(state, { action: 'move', locationId: 'hallway' })
  execute(state, { action: 'move', locationId: 'attic' })
  settle(state)
  assert.equal(state.locations.find(loc => loc.id === 'attic').clues, max - 1)
})

test('N3 同次伤害恐惧可分配给同一资产，全部分配后才弃置', () => {
  const state = fixture()
  const ally = asset(state, '01117')
  enemy(state, { damage: 3, horror: 3 })
  execute(state, { action: 'resource' })
  for (let i = 0; i < 3; i++) answer(state, ally.id)
  assert.equal(state.pendingChoice.kind, 'assign-horror')
  assert.ok(state.investigators[0].assets.some(item => item.id === ally.id))
  for (let i = 0; i < 3; i++) answer(state, ally.id)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].horror, 0)
  assert.ok(state.investigators[0].discard.includes('01117'))
  assert.equal(state.investigators[0].assets.length, 0)
})

test('N3 反应可跳过，不确认不消耗次数、不自动获得线索', () => {
  const state = fixture()
  const target = enemy(state, { health: 1 })
  execute(state, { action: 'fight', enemyId: target.id })
  answer(state, 'done')
  assert.equal(state.pendingChoice.kind, 'reaction')
  assert.equal(state.investigators[0].clues, 0)
  answer(state, 'skip')
  assert.equal(state.investigators[0].clues, 0)
  assert.deepEqual(state.investigators[0].usedReactions, {})
})

test('N3 警戒失败反击但耗竭敌人不反击', () => {
  for (const exhausted of [false, true]) {
    const state = fixture()
    const e = enemy(state, { alert: true, exhausted })
    state.chaosBag = ['autofail']
    execute(state, { action: 'evade', enemyId: e.id })
    settle(state)
    assert.equal(state.investigators[0].damage, exhausted ? 0 : 1)
  }
})

test('N3 搜索和同次分配的暂停状态不包含递归或静态目录副本', () => {
  const state = fixture()
  const book = asset(state, '01031')
  execute(state, { action: 'ability', assetId: book.id, abilityIndex: 0 })
  assert.ok(state.continuation)
  assert.equal(state.continuation.base.continuation, undefined)
  assert.equal(state.continuation.base.cards, undefined)
  assert.equal(state.continuation.base._resolution, undefined)
  assert.ok(JSON.stringify(state).length < 500000)
})

for (const resolution of ['r1', 'r2']) test(`N3 集结剧情选择 ${resolution} 可恢复并进入下关换牌`, () => {
  const state = fixture()
  state.actIndex = 2
  const boss = enemy(state, { code: 'ghoulPriest', health: 1 })
  execute(state, { action: 'fight', enemyId: boss.id })
  answer(state, 'done')
  if (state.pendingChoice.kind === 'reaction') answer(state, 'skip')
  assert.equal(state.pendingChoice.kind, 'story')
  const restored = clone(state)
  answer(state, resolution)
  answer(restored, resolution)
  if (resolution === 'r1') { answer(state, 'skip'); answer(restored, 'skip') }
  assert.equal(state.pendingChoice.kind, 'interlude')
  answer(state, 'done'); answer(restored, 'done')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.pendingChoice.kind, 'mulligan')
  assert.equal(!!state.campaign.records.houseBurned, resolution === 'r1')
})

for (const status of ['defeated', 'resigned']) test(`N3 ${status}队友线索不构成可用共同支付`, () => {
  const state = fixture('01001', 2)
  state.scenario = clone(SCENARIOS.theMidnightMasks)
  state.actIndex = 0
  state.acts = state.scenario.acts
  state.cultistDeck = [...state.scenario.cultistDeck]
  state.investigators[1][status] = true
  state.investigators[1].clues = 4
  state.clues = 4
  reject(state, { action: 'drawCultist' }, /线索/)
  assert.ok(!legalMoves(state).some(move => move.action === 'drawCultist'))
})

test('N3 嵌套阶段暂停恢复的事件与日志一一对应，不漏发或重发', () => {
  const state = fixture()
  state.encounterDeck = ['rottingRemains']
  const before = state.log.length
  const events = applyMove(state, 0, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'commit')
  assert.equal(state.skillTest.source.label, '遭遇检定')
  assert.equal(state.skillTest.source.code, '01163')
  const prefix = state.log.slice(before)
  assert.deepEqual(events.filter(event => event.type === 'info').map(event => event.text), prefix)
  const rest = answer(state, 'done')
  assert.deepEqual([...events, ...rest].filter(event => event.type === 'info').map(event => event.text), state.log.slice(before))
  const results = [...events, ...rest].filter(event => event.type === 'presentation' && event.kind === 'test')
  assert.equal(results.length, 1, '暂停恢复只发出一次已确认检定结果')
  assert.equal(results[0].kind, 'test')
  assert.equal(results[0].skill, 'willpower')
  assert.equal(results[0].difficulty, 3)
  assert.equal(typeof results[0].success, 'boolean')
  assert.ok(results[0].drawn.length > 0)
  const draws = [...events, ...rest].filter(event => event.type === 'presentation' && event.kind === 'chaos')
  assert.deepEqual(draws.map(event => event.token), results[0].drawn, '每次真实抽取只发出一次，恢复不重播')
})

for (const action of ['resource', 'draw', 'play', 'ability']) test(`N3 致命借机攻击跨关后不得续算旧 ${action} 动作`, () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.damage = inv.maxHealth - 1
  inv.hand = ['01018']
  const book = asset(state, '01031')
  enemy(state, { damage: 1, horror: 1 })
  const move = action === 'play' ? { action, cardId: '01018' }
    : action === 'ability' ? { action, assetId: book.id, abilityIndex: 0 } : { action }
  const before = state.log.length
  const events = applyMove(state, 0, move)
  assert.equal(state.pendingChoice.kind, 'storyCard')
  events.push(...answer(state, 'skip'))
  assert.equal(state.pendingChoice.kind, 'interlude')
  events.push(...answer(state, 'done'))
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.pendingChoice.kind, 'mulligan')
  const opening = clone(state.investigators[0])
  const restored = clone(state)
  events.push(...answer(state, 'done'))
  answer(restored, 'done')
  assert.deepEqual(clone(state), restored)
  assert.equal(state.pendingChoice, null)
  assert.equal(state.continuation, null)
  assert.equal(state.investigators[0].resources, opening.resources)
  assert.equal(state.investigators[0].actionsLeft, opening.actionsLeft)
  assert.equal(state.investigators[0].damage, opening.damage)
  assert.equal(state.investigators[0].horror, opening.horror)
  assert.deepEqual(state.investigators[0].hand, opening.hand)
  assert.deepEqual(state.investigators[0].assets, opening.assets)
  assert.deepEqual(state.investigators[0].discard, opening.discard)
  assert.equal(state.round, 1)
  assert.equal(state.doom, 0)
  assert.equal(state.campaign.trauma[0].physical, 1)
  assert.equal(state.log.filter(line => line.startsWith('🎬 第 2 关')).length, 1)
  assert.deepEqual(events.filter(event => event.type === 'info').map(event => event.text), state.log.slice(before))
})

test('N3 敌人阶段导致跨关后不继续旧补给或神话阶段', () => {
  const state = fixture()
  state.investigators[0].damage = state.investigators[0].maxHealth - 1
  enemy(state, { damage: 1, horror: 1 })
  execute(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'storyCard')
  answer(state, 'skip')
  assert.equal(state.pendingChoice.kind, 'interlude')
  answer(state, 'done')
  assert.equal(state.pendingChoice.kind, 'mulligan')
  const opening = clone(state.investigators[0])
  settle(state)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  assert.equal(state.round, 1)
  assert.equal(state.doom, 0)
  assert.equal(state.investigators[0].resources, opening.resources)
  assert.deepEqual(state.investigators[0].hand, opening.hand)
  assert.equal(state.investigators[0].horror, opening.horror)
})

test('N3 猎物并列由队长显式选择，不再取座位号最小者', () => {
  const state = fixture('01001', 2)
  for (const inv of state.investigators) { inv.location = 'study'; inv.clues = 2 }
  state.clues = 4
  const target = enemy(state, { engagedSeat: null, prey: 'mostClues', name: '并列猎物敌人' })
  execute(state, { action: 'endTurn' })
  settle(state)
  execute(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'prey')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['0', '1'])
  answer(state, '1')
  assert.equal(state.enemies.find(item => item.id === target.id).engagedSeat, 1)
  settle(state)

  const single = fixture('01001', 2)
  single.investigators[0].clues = 3
  single.investigators[1].clues = 1
  single.clues = 4
  for (const inv of single.investigators) inv.location = 'study'
  enemy(single, { engagedSeat: null, prey: 'mostClues' })
  execute(single, { action: 'endTurn' })
  settle(single)
  execute(single, { action: 'endTurn' })
  assert.notEqual(single.pendingChoice?.kind, 'prey')
  assert.equal(single.enemies[0].engagedSeat, 0)
})

test('N3 冷漠敌人不自动交战，可用主动交战行动接战', () => {
  const state = fixture()
  const target = enemy(state, { engagedSeat: null, aloof: true, name: '冷漠敌人' })
  execute(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).engagedSeat, null)
  assert.equal(state.investigators[0].engaged.length, 0)
  const engage = legalMoves(state).find(move => move.action === 'engage' && move.enemyId === target.id)
  assert.ok(engage, '同地点敌人应提供主动交战')
  execute(state, engage)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).engagedSeat, 0)
  reject(state, { action: 'engage', enemyId: target.id }, /已经与该敌人交战/)
})

test('N3 猎手等距路线与任意无人地点生成都要显式选择', () => {
  const state = fixture('01001', 2)
  state.locations = ['hallway', 'attic', 'cellar'].map(id => ({ ...SCENARIOS.theGathering.locations[id], revealed: true, clues: 0 }))
  state.investigators[0].location = 'attic'
  state.investigators[1].location = 'cellar'
  const hunter = enemy(state, { engagedSeat: null, hunter: true, location: 'hallway', name: '猎手' })
  execute(state, { action: 'endTurn' })
  settle(state)
  execute(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'hunter')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id).sort(), ['attic', 'cellar'])
  answer(state, 'cellar')
  assert.equal(state.enemies.find(item => item.id === hunter.id).location, 'cellar')
  settle(state)

  const spawn = fixture()
  spawn.locations = ['study', 'hallway', 'attic'].map(id => ({ ...SCENARIOS.theGathering.locations[id], revealed: true, clues: 0 }))
  spawn.encounterDeck = ['acolyte']
  spawn.encounterDiscard = []
  execute(spawn, { action: 'endTurn' })
  assert.equal(spawn.pendingChoice.kind, 'spawn')
  assert.ok(spawn.pendingChoice.options.length > 1)
  assert.ok(!spawn.pendingChoice.options.some(option => option.id === 'study'), '有调查员的地点不是空地点')
  answer(spawn, 'hallway')
  settle(spawn)
  assert.equal(spawn.enemies.find(item => item.code === 'acolyte').location, 'hallway')
})

test('N3 补弹在多个弹药武器时由持有者选择目标', () => {
  const state = fixture()
  const original = EFFECTS['01088'].event
  try {
    EFFECTS['01088'].event = { type: 'reloadAmmo', amount: 3 }
    const pistol = asset(state, '01016', { uses: 0, usesType: 'ammo' })
    const shotgun = asset(state, '01029', { uses: 0, usesType: 'ammo' })
    state.investigators[0].hand = ['01088']
    execute(state, { action: 'play', cardId: '01088' })
    assert.equal(state.pendingChoice.kind, 'reload')
    assert.deepEqual(state.pendingChoice.options.map(option => option.id).sort(), [pistol.id, shotgun.id].sort())
    answer(state, shotgun.id)
    settle(state)
    assert.equal(state.investigators[0].assets.find(item => item.id === shotgun.id).uses, 3)
    assert.equal(state.investigators[0].assets.find(item => item.id === pistol.id).uses, 0)
  } finally { EFFECTS['01088'].event = original }
})

test('N3 愤怒逐点选择弃牌或伤害恐惧，无牌可弃时仍可完成', () => {
  const state = fixture()
  state.investigators[0].hand = ['01088', '01089']
  state.encounterDeck = ['umordhothsWrath']
  state.encounterDiscard = []
  state.chaosBag = ['autofail']
  execute(state, { action: 'endTurn' })
  answer(state, 'done')
  assert.equal(state.pendingChoice.kind, 'discard')
  const before = [...state.investigators[0].hand]
  assert.equal(state.pendingChoice.options.length, before.length + 1)
  assert.ok(state.pendingChoice.options.some(option=>option.id==='harm'))
  answer(state, '1')
  assert.deepEqual(state.investigators[0].hand, before.filter((_, index) => index !== 1))
  assert.ok(state.investigators[0].discard.includes(before[1]))
  while (state.pendingChoice?.kind === 'discard') answer(state, state.pendingChoice.options.some(option=>option.id==='0')?'0':'harm')
  settle(state)

  const empty = fixture()
  // 自动失败的最终检定值为 0，此检定会造成 5 点伤害与恐惧；避免战败后重置场景干扰本断言。
  empty.investigators[0].maxHealth = 20
  empty.investigators[0].maxSanity = 20
  empty.investigators[0].hand = []
  empty.investigators[0].deck = []
  empty.investigators[0].discard = []
  empty.encounterDeck = ['umordhothsWrath']
  empty.encounterDiscard = []
  empty.chaosBag = ['autofail']
  execute(empty, { action: 'endTurn' })
  answer(empty, 'done')
  while (empty.pendingChoice?.kind === 'discard') answer(empty, 'harm')
  settle(empty)
  assert.equal(empty.investigators[0].damage, 5)
  assert.equal(empty.investigators[0].horror, 5)
})

test('N3 攻击他人交战的敌人失败会误伤该调查员 1 点', () => {
  const state = fixture('01001', 2)
  for (const inv of state.investigators) inv.location = 'study'
  const target = enemy(state, { engagedSeat: 1, fight: 9 })
  state.investigators[0].engaged = []
  state.chaosBag = ['autofail']
  execute(state, { action: 'fight', enemyId: target.id })
  settle(state)
  assert.equal(state.investigators[1].damage, 1)
  assert.equal(state.investigators[0].damage, 0)
})

for (const mode of ['defeated', 'resigned']) test(`N3 调查员${mode === 'defeated' ? '败退' : '撤退'}时线索放回所在地点`, () => {
  const state = fixture('01001', 2)
  const location = { ...SCENARIOS.theGathering.locations.study, revealed: true, clues: 0 }
  state.locations = [location]
  for (const inv of state.investigators) inv.location = 'study'
  state.investigators[1].clues = 3
  state.clues = 3
  if (mode === 'resigned') {
    state.locations[0].resign = true
    state.currentSeat = 1
    execute(state, { action: 'resign' })
  } else {
    enemy(state, { engagedSeat: 1, damage: 99 })
    state.investigators[0].engaged = []
    execute(state, { action: 'endTurn' })
    settle(state)
    execute(state, { action: 'endTurn' })
    settle(state)
  }
  assert.ok(state.investigators[1][mode])
  assert.equal(state.investigators[1].clues, 0)
  assert.equal(state.clues, 0)
  assert.equal(state.locations.find(loc => loc.id === 'study').clues, 3)
})

test('N3 闪躲在敌人攻击窗口取消该次攻击，恢复后不重复支付', () => {
  const state = fixture()
  state.investigators[0].hand = ['01023']
  enemy(state, { damage: 2, horror: 1 })
  execute(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'reaction')
  assert.equal(state.pendingChoice.options.length, 2)
  const play = state.pendingChoice.options.find(option => option.id !== 'skip').id
  const control = clone(state)
  const restored = clone(state)
  answer(state, play)
  answer(restored, play)
  assert.deepEqual(clone(state), restored)
  settle(state)
  answer(control, 'skip')
  settle(control)
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].horror, 0)
  assert.equal(control.investigators[0].damage, 2)
  assert.equal(control.investigators[0].horror, 1)
  assert.equal(control.investigators[0].resources - state.investigators[0].resources, ALL_CARDS['01023'].cost)
  assert.ok(state.investigators[0].discard.includes('01023'))
  assert.ok(state.log.some(line => line.includes('攻击被取消')))
})

test('N3 守护结界取消诡计显现效果并承受 1 点恐惧', () => {
  const state = fixture()
  state.investigators[0].hand = ['01065']
  state.encounterDeck = ['rottingRemains']
  state.encounterDiscard = []
  execute(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'reaction')
  answer(state, state.pendingChoice.options.find(option => option.id !== 'skip').id)
  settle(state)
  assert.equal(state.investigators[0].horror, 1)
  assert.ok(state.log.some(line => line.includes('显现效果被取消')))
})

test('N3 心胜于物本轮以智识替代战斗与敏捷', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['01036']
  inv.combat = 1
  inv.intellect = 5
  execute(state, { action: 'play', cardId: '01036' })
  settle(state)
  assert.deepEqual(state.investigators[0].skillSubstitute, { from: ['combat', 'agility'], to: 'intellect', round: state.round })
  const target = enemy(state, { fight: 4, health: 5 })
  execute(state, { action: 'fight', enemyId: target.id })
  settle(state)
  assert.equal(state.enemies[0].damageTaken, 1)
})

test('N3 反应事件不能作为普通行动打出', () => {
  const state = fixture()
  state.investigators[0].hand = ['01023', '01065']
  for (const code of ['01023', '01065']) {
    reject(state, { action: 'play', cardId: code }, /反应窗口/)
    assert.ok(!legalMoves(state).some(move => move.action === 'play' && move.cardId === code))
  }
})
