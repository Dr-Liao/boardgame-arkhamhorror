import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat, getMaxSanity } from '../src/engine/engine.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { cardIdentityFields } from '../src/cards/card-identity.js'
import { viewState } from '../src/integration/observation.js'
import { campaignCardChange } from '../src/campaign/campaign.js'

const clone = value => JSON.parse(JSON.stringify(value))
function move(state, command) {
  const seat = decisionSeat(state)
  assert.equal(validateMove(state, seat, command), null, JSON.stringify(command))
  applyMove(state, seat, command)
}
function answer(state, id) { move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId: id }) }
function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 150)
    const choice = state.pendingChoice
    answer(state, ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id)) || choice.options[0].id)
  }
}
function fixture(count = 1, seed = 'n4-notz') {
  const state = createGameState({ playerInvestigator: '01001', seed }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  state.chaosBag = ['0']
  for (const inv of state.investigators) { inv.hand = []; inv.deck = ['01088', '01088']; inv.actionsLeft = 3 }
  return state
}
function midnight(state) {
  state.actIndex = 2
  move(state, { action: 'resource' })
  assert.equal(state.pendingChoice.kind, 'story')
  answer(state, 'r2'); settle(state)
  assert.equal(state.scenario.id, 'theMidnightMasks')
}
function litaFixture() {
  const state = fixture()
  state.actIndex = 1
  state.investigators[0].clues = 3
  state.clues = 3
  state.investigators[0].location = 'hallway'
  state.locations = ['hallway', 'parlor'].map(id => ({ ...SCENARIOS.theGathering.locations[id], clues: 0, revealed: true }))
  state.encounterDeck = ['dissonantVoices']
  move(state, { action: 'endTurn' }); answer(state, 'advance'); answer(state, '3'); settle(state)
  return state
}

function barrierFixture() {
  const state = fixture()
  state.investigators[0].clues = 2
  state.clues = 2
  move(state, { action: 'advanceAct' }); settle(state)
  assert.equal(state.actIndex, 1)
  assert.equal(state.investigators[0].location, 'hallway')
  assert.equal(state.locations.find(loc => loc.id === 'parlor').revealed, false)
  return state
}

test('集结灼热屏障阻止普通移动，拒绝请求不会花费行动或改变状态，旧存档同样受限', () => {
  const original = barrierFixture()
  for (const state of [original, clone(original)]) {
    if (state !== original) state.locations.find(loc => loc.id === 'parlor').revealed = true
    const command = { action: 'move', locationId: 'parlor' }
    assert.ok(!legalMoves(state).some(m => m.action === 'move' && m.locationId === 'parlor'))
    for (const locationId of ['attic', 'cellar']) {
      assert.ok(legalMoves(state).some(m => m.action === 'move' && m.locationId === locationId))
      assert.equal(validateMove(state, 0, { action: 'move', locationId }), null)
    }
    const before = clone(state)
    assert.match(validateMove(state, 0, command), /灼热屏障/)
    assert.throws(() => applyMove(state, 0, command), /灼热屏障/)
    assert.deepEqual(clone(state), before)
  }
})

test('集结灼热屏障阻止卡牌移动选项，恢复选择后仍能前往合法地点', () => {
  const state = barrierFixture()
  state.investigators[0].assets.push({ id: 'cat-burglar', code: '01055', exhausted: false })
  move(state, { action: 'ability', assetId: 'cat-burglar', abilityIndex: 0 })
  assert.equal(state.pendingChoice.kind, 'move')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id).sort(), ['attic', 'cellar'])
  const restored = clone(state)
  answer(state, 'attic'); settle(state)
  answer(restored, 'attic'); settle(restored)
  assert.equal(state.investigators[0].location, 'attic')
  assert.deepEqual(clone(state), restored)
})

test('集结幕二结束时支付线索解除屏障，揭示客厅后允许移动进入', () => {
  const state = barrierFixture()
  state.investigators[0].clues = 3
  state.clues = 3
  state.encounterDeck = ['dissonantVoices']
  move(state, { action: 'endTurn' }); answer(state, 'advance'); answer(state, '3'); settle(state)
  assert.equal(state.actIndex, 2)
  assert.equal(state.locations.find(loc => loc.id === 'parlor').revealed, true)
  assert.ok(state.storyAssets.some(asset => asset.code === '01117' && asset.location === 'parlor'))
  assert.ok(legalMoves(state).some(m => m.action === 'move' && m.locationId === 'parlor'))
  move(state, { action: 'move', locationId: 'parlor' }); settle(state)
  assert.equal(state.investigators[0].location, 'parlor')
})

for (const count of [1, 2, 3, 4]) test(`N4 午夜假面 ${count} 人祭司数量守恒且保持独立异教徒牌堆`, () => {
  const state = fixture(count)
  midnight(state)
  assert.equal(state.enemies.filter(enemy => enemy.code === 'acolyte').length, count - 1)
  assert.equal(state.encounterDeck.filter(code => code === 'acolyte').length, 4 - count)
  assert.deepEqual(state.enemies.map(enemy => enemy.location), ['southside', 'downtown', 'graveyard'].slice(0, count - 1))
  assert.ok(state.enemies.every(enemy => enemy.originalCode === '01169' && enemy.doom === 1))
  assert.equal(state.cultistDeck.length, 5)
  assert.ok(!state.encounterDeck.some(code => state.cultistDeck.includes(code)))
})

test('N4 普通遭遇敌人在场时不进弃牌，击败后只进遭遇弃牌而非胜利区', () => {
  const state = fixture()
  state.encounterDeck = ['swarmOfRats']
  move(state, { action: 'endTurn' }); settle(state)
  assert.equal(state.enemies.length, 1)
  assert.ok(!state.encounterDiscard.includes('swarmOfRats'))
  move(state, { action: 'fight', enemyId: state.enemies[0].id }); settle(state)
  assert.equal(state.encounterDiscard.filter(code => code === 'swarmOfRats').length, 1)
  assert.ok(!state.victoryDisplay.some(card => card.code === 'swarmOfRats'))
})

test('N4 被取消的持续诡计正常弃置，不凭空消失或进入威胁区', () => {
  const state = fixture()
  state.investigators[0].hand = ['01065']
  state.encounterDeck = ['dreamsOfRlyeh']
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'reaction')
  const option = state.pendingChoice.options.find(option => option.id !== 'skip').id
  answer(state, option); settle(state)
  assert.equal(state.investigators[0].threat.length, 0)
  assert.equal(state.encounterDiscard.filter(code => code === 'dreamsOfRlyeh').length, 1)
})

test('N4 四个使者组数量与漏牌原编号准确，实际第三关牌堆包含完整选中组', () => {
  const sc = SCENARIOS.theDevourerBelow
  assert.equal(sc.treacheries.theYellowSign.originalCode, '01176')
  assert.equal(sc.treacheries.dreamsOfRlyeh.originalCode, '01182')
  const seen = new Set()
  for (let seed = 0; seen.size < 4 && seed < 24; seed++) {
    const state = fixture(1, 'n4-agents-' + seed)
    midnight(state)
    move(state, { action: 'resign' }); settle(state)
    assert.equal(state.scenario.id, 'theDevourerBelow')
    const selected = Object.entries(sc.agentSets).find(([, cards]) => cards.every(code => state.encounterDeck.includes(code)))
    assert.ok(selected)
    seen.add(selected[0])
    for (const code of new Set(selected[1])) {
      assert.equal(state.encounterDeck.filter(card => card === code).length, selected[1].filter(card => card === code).length)
    }
    assert.equal(state.encounterDeck.length, sc.encounterDeck.length + 4)
    assert.equal(state.locations.length, 5)
  }
  assert.equal(seen.size, 4)
})

test('N4 黄衣之印失败受到恐惧并显式搜索抽取疯狂弱点，恢复不会重复恐惧', () => {
  const state = fixture()
  state.investigators[0].willpower = 0
  state.investigators[0].deck = ['01096', '01088']
  state.encounterDeck = ['theYellowSign']
  move(state, { action: 'endTurn' })
  assert.equal(state.pendingChoice.kind, 'commit')
  answer(state, 'done')
  assert.equal(state.pendingChoice.kind, 'search')
  assert.equal(state.investigators[0].horror, 2)
  const restored = clone(state)
  const id = state.pendingChoice.options[0].id
  answer(state, id); answer(restored, id)
  settle(state); settle(restored)
  assert.deepEqual(clone(state), restored)
  assert.ok(!state.investigators[0].deck.includes('01096'))
  assert.equal(state.investigators[0].hand.length, 1)
  assert.equal(state.investigators[0].horror, 2)
})

test('N4 克苏鲁梦境降低意志与神智，同地点队友可检定移除而远处队友不行', () => {
  const state = fixture(2)
  const target = { id: 'dream', code: 'dreamsOfRlyeh', ...cardIdentityFields(SCENARIOS.theDevourerBelow.treacheries.dreamsOfRlyeh) }
  state.investigators[1].threat = [target]
  assert.equal(getMaxSanity(state.investigators[1]), state.investigators[1].maxSanity - 1)
  assert.equal(viewState(state, 0).investigators[1].maxSanity, getMaxSanity(state.investigators[1]))
  state.investigators[1].location = 'elsewhere'
  assert.ok(!legalMoves(state).some(command => command.threatId === target.id))
  state.investigators[1].location = 'study'
  assert.ok(legalMoves(state).some(command => command.action === 'discardThreat' && command.threatId === target.id))
  state.chaosBag = ['autofail']
  move(state, { action: 'discardThreat', threatId: target.id }); settle(state)
  assert.equal(state.investigators[1].threat.length, 1)
  state.chaosBag = ['0']
  move(state, { action: 'discardThreat', threatId: target.id }); settle(state)
  assert.equal(state.investigators[1].threat.length, 0)
  assert.equal(state.encounterDiscard.filter(code => code === 'dreamsOfRlyeh').length, 1)
  assert.ok(!state.investigators[1].discard.includes('dreamsOfRlyeh'))
  assert.equal(getMaxSanity(state.investigators[1]), state.investigators[1].maxSanity)
})

test('N4 梦境显现降低神智至已有恐惧时立即败退，不必再受恐惧', () => {
  const state = fixture()
  state.investigators[0].horror = state.investigators[0].maxSanity - 1
  state.encounterDeck = ['dreamsOfRlyeh']
  move(state, { action: 'endTurn' })
  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.pendingChoice.kind, 'storyCard')
  settle(state)
  assert.equal(state.campaign.trauma[0].mental, 1)
})

test('N4 幕二丽塔无人控制，谈判成功转移同一实例而非生成副本', () => {
  const state = litaFixture()
  assert.equal(state.storyAssets.length, 1)
  const original = clone(state.storyAssets[0])
  assert.equal(original.location, 'parlor')
  assert.equal(original.controllerSeat, null)
  assert.ok(!state.investigators[0].assets.some(asset => asset.code === '01117'))
  state.investigators[0].location = 'parlor'
  state.investigators[0].engaged = []
  state.enemies[0].engagedSeat = null
  state.investigators[0].intellect = 4
  state.chaosBag = ['0']
  move(state, { action: 'parleyLita' }); settle(state)
  const lita = state.investigators[0].assets.find(asset => asset.code === '01117')
  assert.equal(lita.id, original.id)
  assert.equal(lita.originalCode, '01117')
  assert.equal(lita.controllerSeat, 0)
  assert.equal(state.storyAssets.length, 0)
  assert.ok(!legalMoves(state).some(command => command.action === 'parleyLita'))
})

test('N4 献祭限本人控制且与首领同地点，永久移除丽塔并记录幸存而非胜利', () => {
  const state = fixture(2)
  state.scenario = clone(SCENARIOS.theDevourerBelow)
  state.acts = state.scenario.acts; state.agendas = state.scenario.agendas
  state.campaign.scenarioIndex = 2
  state.locations = [{ ...state.scenario.locations.mainPath, revealed: true, clues: 0 }]
  for (const inv of state.investigators) inv.location = 'mainPath'
  state.enemies = [{ id: 'umordhoth', code: 'umordhoth', location: 'remote', massive: true, health: 20, damageTaken: 0, damage: 0, horror: 0 }]
  campaignCardChange(state.campaign, 1, '01117', 'add', 'fixture')
  const lita = { id: 'lita', code: '01117', exhausted: false }
  state.investigators[1].assets = [lita]
  assert.ok(!legalMoves(state).some(command => command.action === 'sacrificeLita'))
  state.enemies[0].location = 'mainPath'
  assert.match(validateMove(state, 0, { action: 'sacrificeLita' }), /没有控制/)
  state.investigators[1].assets = []
  state.investigators[0].assets = [lita]
  const before = state.investigators.map(inv => state.campaign.investigators[inv.seat].deck.length)
  move(state, { action: 'sacrificeLita' }); settle(state)
  assert.equal(state.outcome, 'survived')
  assert.ok(!state.campaign.investigators[1].deck.includes('01117'))
  assert.equal(state.campaign.investigators[1].removedCards[0].reason, 'sacrificedLita')
  assert.deepEqual(state.campaign.trauma[0], { physical: 2, mental: 2 })
  for (const inv of state.investigators) {
    const deck = state.campaign.investigators[inv.seat].deck
    assert.equal(deck.length, before[inv.seat] + 1 - (inv.seat === 1 ? 1 : 0))
    assert.ok(deck.some(code => ALL_CARDS[code].traits.some(trait => trait.toLowerCase() === 'madness')))
  }
})
