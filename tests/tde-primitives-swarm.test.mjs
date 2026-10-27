// TDE P3 批次 2：蜂拥卡放置与击败判定（swarm.placeCards）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearSwarmCards, placeSwarmCards, removeSwarmCard, splitSwarmingDamage, swarmBlockedReason,
  swarmCanBeDefeated, swarmCardsOf, swarmCountOf, swarmHostOf,
} from '../src/engine/swarm.js'

const host = () => ({ id: 'enemy1', code: '06102', name: 'Swarm of Spiders', health: 6, damageTaken: 0 })
const stateWithDeck = (codes) => ({ instanceSeq: {}, encounterDeck: [...codes], enemies: [] })

test('按遭遇牌库顶放置蜂拥卡：实例 id、hostId、数量', () => {
  const state = stateWithDeck(['06103', '06103', '06103'])
  const target = host()
  state.enemies.push(target)
  const added = placeSwarmCards(state, target, 2)
  assert.equal(added.length, 2)
  assert.deepEqual(added.map(card => card.code), ['06103', '06103'])
  assert.deepEqual(added.map(card => card.id), ['swarm1', 'swarm2'])
  assert.equal(added[0].hostId, 'enemy1')
  assert.equal(swarmCountOf(target), 2)
  assert.equal(state.encounterDeck.length, 1)
})

test('蜂拥卡抽不够时抛错，不静默少放', () => {
  const state = stateWithDeck(['06103'])
  const target = host()
  assert.throws(() => placeSwarmCards(state, target, 2), /蜂拥卡不足/)
  assert.equal(swarmCountOf(target), 1, '已抽到的 1 张仍算放置')
})

test('自定义 draw：X 由外部求值后注入', () => {
  const state = { instanceSeq: {} }
  const target = host()
  const added = placeSwarmCards(state, target, 3, { draw: () => '06102', source: 'test' })
  assert.equal(added.length, 3)
  assert.ok(added.every(card => card.source === 'test'))
})

test('蜂拥头领不能被击败；清空后可击败', () => {
  const state = stateWithDeck(['a', 'a'])
  const target = host()
  placeSwarmCards(state, target, 2)
  assert.equal(swarmCanBeDefeated(target), false)
  assert.match(swarmBlockedReason(target), /仍有 2 张蜂拥卡/)
  assert.equal(removeSwarmCard(target, 'swarm1'), true)
  assert.equal(removeSwarmCard(target, 'swarm1'), false, '同一张不能移除两次')
  assert.equal(swarmCountOf(target), 1)
  assert.deepEqual(clearSwarmCards(target), ['swarm2'])
  assert.equal(swarmCanBeDefeated(target), true)
  assert.equal(swarmBlockedReason(target), null)
})

test('蜂拥卡不能作为头领', () => {
  const swarmCard = { id: 'swarm9', hostId: 'enemy1' }
  assert.throws(() => placeSwarmCards({}, swarmCard, 1), /蜂拥卡不能作为头领/)
  assert.throws(() => placeSwarmCards({}, null, 1), /头领敌人对象/)
})

test('溢出伤害：先打空头领，再逐张扣蜂拥卡', () => {
  const target = host()
  target.swarmCards = [
    { id: 'swarm1', health: 1, defeated: false },
    { id: 'swarm2', health: 2, defeated: false },
  ]
  assert.deepEqual(splitSwarmingDamage(target, 7, 6), { toHost: 6, toSwarm: 1, defeatedSwarm: ['swarm1'], leftover: 0 })
  assert.deepEqual(splitSwarmingDamage(target, 10, 6), { toHost: 6, toSwarm: 3, defeatedSwarm: ['swarm1', 'swarm2'], leftover: 1 })
  assert.deepEqual(splitSwarmingDamage(target, 2, 6), { toHost: 2, toSwarm: 0, defeatedSwarm: [], leftover: 0 })
})

test('swarmHostOf：蜂拥卡反查头领；头领返回自身', () => {
  const state = stateWithDeck(['a'])
  const target = host()
  state.enemies.push(target)
  const [swarmCard] = placeSwarmCards(state, target, 1)
  state.enemies.push({ ...swarmCard })
  assert.equal(swarmHostOf(state, target), target)
  assert.equal(swarmHostOf(state, swarmCard), target)
  assert.equal(swarmHostOf(state, { hostId: 'nope' }), null)
})

test('JSON 往返后蜂拥关系保持', () => {
  const state = stateWithDeck(['a', 'a'])
  const target = host()
  placeSwarmCards(state, target, 2)
  const restored = JSON.parse(JSON.stringify(target))
  assert.equal(swarmCountOf(restored), 2)
  assert.deepEqual(swarmCardsOf(restored).map(card => card.id), ['swarm1', 'swarm2'])
})
