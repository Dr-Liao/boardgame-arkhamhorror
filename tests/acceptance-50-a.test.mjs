import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, play, move, settle, validateMove } from './core-fixture.mjs'
import { drawEncounter, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

test('50006 打出后支付费用、消耗一次行动并获得十个资源', () => {
  const state = fixture('01003')
  play(state, '50006')
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.resources, 35)
  assert.equal(inv.actionsLeft, 19)
  assert.deepEqual(inv.discard, ['50006'])
})

test('51003 无线索时不能打出，有线索时抽三张且不发现线索', () => {
  const state = fixture('01002')
  const inv = state.investigators[0]
  const location = state.locations.find(location => location.id === inv.location)
  const command = { action: 'play', cardId: '51003' }
  inv.hand = ['51003']
  location.clues = 0
  assert.match(validateMove(state, 0, command), /线索/)
  location.clues = 1
  move(state, command)
  settle(state)
  assert.deepEqual(state.investigators[0].hand, Array(3).fill('01088'))
  assert.equal(state.investigators[0].deck.length, 27)
  assert.equal(state.locations.find(item => item.id === location.id).clues, 1)
})

test('51010 只能投入自己的较难检定且万能图标最多三个', () => {
  for (const [difficulty, expected] of [[2, null], [4, 2], [7, 3]]) {
    const state = fixture('01002', 2)
    for (const inv of state.investigators) inv.hand = ['51010']
    let result
    let offered = false
    const execute = draft => { result = performTest(draft, 0, 'willpower', difficulty, { baseValue: 2 }) }
    resolveTransaction(state, 0, { action: 'acceptance-test' }, execute)
    for (let step = 0; state.pendingChoice; step++) {
      assert.ok(step < 20)
      const choice = state.pendingChoice
      const commit = choice.kind === 'commit' && choice.options.find(option => option.id === '0')
      if (commit) {
        assert.equal(choice.seat, 0)
        offered = true
      }
      const optionId = commit?.id ?? choice.options.find(option => ['done', 'skip'].includes(option.id))?.id
        ?? choice.options[0].id
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
    assert.equal(offered, expected !== null)
    assert.equal(result.value, expected === null ? 2 : 2 + 2 + expected)
    assert.deepEqual(state.investigators[1].hand, ['51010'])
  }
})

test('51011 普通牌移除拥有者的同号副本，牌库顶是弱点则按常规抽取', () => {
  for (const topIsWeakness of [false, true]) {
    const state = fixture('01001', 2)
    const code = topIsWeakness ? '01097' : '01088'
    const [owner, teammate] = state.investigators
    owner.deck = [code, code, '51011']
    owner.hand = [code]
    owner.discard = [code]
    teammate.hand = [code]
    move(state, { action: 'draw' })
    settle(state)
    assert.equal((state.removedFromGame || []).filter(item => item === code).length, topIsWeakness ? 0 : 4)
    assert.equal(state.investigators[0].deck.filter(item => item === code).length, topIsWeakness ? 1 : 0)
    if (topIsWeakness) assert.equal(state.investigators[0].resources, 0)
    assert.deepEqual(state.investigators[1].hand, [code])
  }
})

function gathering() {
  return fixture('01001', 1, { campaignId: 'returnToNightOfTheZealot' })
}

test('50017 揭示走廊后将选中的阁楼、地窖及客厅放置入场', () => {
  const state = gathering()
  const { atticId, cellarId } = state.scenarioFlags.retGatheringVariants
  const rooms = [atticId, cellarId, 'parlor']
  assert.ok(rooms.every(id => !state.locations.some(location => location.id === id)))
  state.investigators[0].location = 'guestHall'
  state.investigators[0].clues = 3
  move(state, { action: 'resource' })
  settle(state)
  assert.ok(state.locations.find(location => location.code === '50017')?.revealed)
  assert.ok(rooms.every(id => state.locations.some(location => location.id === id && !location.revealed)))
})

for (const [code, locationId, variantField, destination] of [
  ['50018', 'atticReturn', 'atticId', 'farAboveYourHouse'],
  ['50020', 'cellarReturn', 'cellarId', 'deepBelowYourHouse'],
]) {
  test(`${code} 首次揭示后放置关联地点，关联地点保持未揭示`, () => {
    const state = gathering()
    state.scenarioFlags.retGatheringVariants[variantField] = locationId
    state.investigators[0].location = 'guestHall'
    state.investigators[0].clues = 3
    move(state, { action: 'resource' })
    settle(state)
    assert.ok(!state.locations.some(location => location.id === destination))
    move(state, { action: 'move', locationId })
    settle(state)
    assert.ok(state.locations.find(location => location.code === code)?.revealed)
    assert.equal(state.locations.find(location => location.id === destination)?.revealed, false)
  })
}

for (const [code, locationId, keyword] of [
  ['50022', 'bedroom', 'hunter'],
  ['50023', 'bathroom', 'retaliate'],
]) {
  test(`${code} 从遭遇牌库抽取后在印刷指定地点生成并携带关键词`, () => {
    const state = gathering()
    state.encounterDeck = [code]
    resolveTransaction(state, 0, { action: 'acceptance-encounter' }, draft => {
      drawEncounter(draft, draft.investigators[0], [])
    })
    settle(state)
    const drawn = state.enemies.find(enemy => enemy.code === code)
    assert.equal(drawn?.location, locationId)
    assert.equal(drawn?.[keyword], true)
    assert.equal(drawn?.victory, 1)
  })
}
