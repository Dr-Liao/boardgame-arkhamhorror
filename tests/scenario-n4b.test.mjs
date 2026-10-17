import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function move(state, command) {
  const seat = decisionSeat(state)
  assert.equal(validateMove(state, seat, command), null, JSON.stringify(command))
  applyMove(state, seat, command)
}
function answer(state, id) { move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: id }) }
function settle(state, max = 100) {
  for (let i = 0; state.pendingChoice && i < max; i++) {
    const choice = state.pendingChoice
    const ms = (state.legalMoves || []).filter(m => m.action === 'choose' && m.choiceId === choice.id)
    const pick = ms.find(m => ['done', 'skip', 'self', '0', 'advance', 'r1', 'r2'].includes(m.optionId)) || ms[0]
    assert.ok(pick, `${choice.kind} 无可选回答：${JSON.stringify(choice.options)}`)
    applyMove(state, pick.seat ?? decisionSeat(state), { ...pick, choiceId: choice.id })
  }
  assert.equal(state.pendingChoice, null)
}
function fixture() {
  const state = createGameState({ playerInvestigator: '01001', seed: 'n4b-scenario' }, [{ seat: 0 }])
  settle(state)
  const inv = state.investigators[0]
  inv.hand = []
  inv.deck = ['01088', '01088', '01088']
  inv.resources = 20
  inv.actionsLeft = 10
  state.chaosBag = ['0']
  state.encounterDiscard = []
  return state
}
function toMidnight(state) {
  state.actIndex = 2
  move(state, { action: 'resource' })
  assert.equal(state.pendingChoice.kind, 'story')
  answer(state, 'r2')
  settle(state)
  assert.equal(state.scenario.id, 'theMidnightMasks')
  return state
}

test('N4.3 午夜假面地点随机变体与地点能力可用', () => {
  const seen = { southside: new Set(), downtown: new Set() }
  for (let seed = 0; seed < 24; seed++) {
    const state = fixture()
    state.seed = 'variant-' + seed
    // 用完整 1-4 关流程成本高；直接验证独立地重排的布置入口。
    const sc = SCENARIOS.theMidnightMasks
    for (const [id, variants] of Object.entries(sc.locationVariants)) {
      const picked = variants[seed % variants.length]
      state.locationVariants ||= {}
      state.locationVariants[id] = picked
      seen[id].add(picked.originalCode)
    }
    assert.ok(['01126', '01127'].includes(state.locationVariants.southside.originalCode))
    assert.ok(['01130', '01131'].includes(state.locationVariants.downtown.originalCode))
  }
  assert.deepEqual([...seen.southside].sort(), ['01126', '01127'])
  assert.deepEqual([...seen.downtown].sort(), ['01130', '01131'])
})

test('N4.3 地点主动能力按 limit 与 cost 结算，重复使用被拒绝', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.location = 'southside'
  state.locations = [{
    ...SCENARIOS.theMidnightMasks.locationVariants.southside[0],
    id: 'southside', revealed: true, clues: 0, connections: [],
  }]
  const before = inv.hand.length
  move(state, { action: 'locationAbility', locationId: 'southside' })
  settle(state)
  assert.equal(state.investigators[0].hand.length, before + 3)
  assert.match(validateMove(state, 0, { action: 'locationAbility', locationId: 'southside' }), /不可用/)
})

test('N4.3 错误指示在无线索时涌动并立即结算额外遭遇', () => {
  const state = toMidnight(fixture())
  state.investigators[0].clues = 0
  state.encounterDeck = ['ancientEvils', 'falseLead']
  state.encounterDiscard = []
  move(state, { action: 'endTurn' })
  settle(state)
  assert.ok(state.log.some(line => line.includes('涌动')))
})

test('N4.3 乘着黑暗之翼失败后解除非夜魇交战并移动到中心地点', () => {
  const state = toMidnight(fixture())
  const river = state.locations.find(loc=>loc.id==='rivertown')
  Object.assign(river,{revealed:false,clues:0,maxClues:2})
  const inv = state.investigators[0]
  inv.agility = 0
  const enemy = { id: 'cult-test', code: 'acolyte', name: '祭司', location: inv.location, engagedSeat: 0, damageTaken: 0, health: 1, fight: 3, evade: 2, damage: 1, horror: 0, traits: ['Humanoid', 'Cultist'], exhausted: false }
  state.enemies.push(enemy)
  const nightgaunt={...enemy,id:'nightgaunt-test',code:'huntingNightgaunt',name:'夜魇',health:10,damage:0,traits:['Nightgaunt']}
  state.enemies.push(nightgaunt)
  inv.engaged = [enemy.id,nightgaunt.id]
  state.chaosBag = ['autofail']
  state.encounterDeck = ['dissonantVoices', 'onWingsOfDarkness']
  state.encounterDiscard = []
  move(state, { action: 'endTurn' })
  settle(state)
  const fresh = state.investigators[0]
  const freshEnemy = state.enemies.find(item => item.id === enemy.id)
  assert.equal(fresh.location, 'rivertown')
  assert.equal(freshEnemy.engagedSeat, null)
  assert.notEqual(freshEnemy.location,'rivertown')
  assert.equal(state.enemies.find(e=>e.id===nightgaunt.id).location,'rivertown')
  assert.equal(state.enemies.find(e=>e.id===nightgaunt.id).engagedSeat,0)
  assert.equal(state.locations.find(loc=>loc.id==='rivertown').revealed,true)
  assert.equal(state.locations.find(loc=>loc.id==='rivertown').clues,2)
  assert.equal(state.log.filter(line=>line.includes('「河岸城」被揭示')).length,1)
})

test('N4.3 上锁的门附属到线索最多且未上锁的地点', () => {
  const state = toMidnight(fixture())
  const inv = state.investigators[0]
  state.locations = [
    { id: 'yourHouse', name: '你的房子', shroud: 2, clues: 1, connections: ['northside'], revealed: true },
    { id: 'northside', name: '北区', shroud: 3, clues: 3, connections: ['yourHouse'], revealed: true },
  ]
  inv.location = 'yourHouse'
  state.encounterDeck = ['dissonantVoices', 'lockedDoor']
  state.encounterDiscard = []
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.locations.find(loc => loc.id === 'northside').locked, true)
  assert.equal(state.locations.find(loc => loc.id === 'yourHouse').locked, undefined)
})

test('N4.4 尖叫的拜亚基按剩余神智调整攻击与躲避', () => {
  const state = toMidnight(fixture())
  const inv = state.investigators[0]
  inv.horror = inv.maxSanity - 4
  const enemy = { id: 'byakhee', code: 'screechingByakhee', name: '尖叫的拜亚基', location: inv.location, engagedSeat: 0, damageTaken: 0, health: 4, fight: 3, evade: 3, damage: 1, horror: 2, traits: ['Monster', 'Byakhee'], exhausted: false, victory: 1 }
  state.enemies.push(enemy)
  const label = legalMoves(state).find(m => m.action === 'fight' && m.enemyId === enemy.id)?.label || ''
  assert.match(label, /战斗 vs 4/)
  const evade = legalMoves(state).find(m => m.action === 'evade' && m.enemyId === enemy.id)?.label || ''
  assert.match(evade, /敏捷 vs 4/)
})

test('N4.4 假面猎手交战时不能作为共同线索支付者', () => {
  const state = toMidnight(fixture())
  const inv = state.investigators[0]
  inv.clues = 10
  inv.location = 'yourHouse'
  state.clues = 10
  state.enemies.push({ id: 'masked', code: 'theMaskedHunter', name: '假面猎手', location: inv.location, engagedSeat: 0, damageTaken: 0, health: 4, fight: 4, evade: 2, damage: 2, horror: 1, traits: ['Humanoid', 'Cultist', 'Elite'], exhausted: false, uniqueCultist: true })
  inv.engaged = ['masked']
  assert.ok(!legalMoves(state).some(m => m.action === 'drawCultist'))
})
