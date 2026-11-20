import test from 'node:test'
import assert from 'node:assert/strict'
import { enemyDef } from '../src/engine/card-lookup.js'
import { asset, enemy, fixture, legalMoves, move, play, settle } from './core-fixture.mjs'

const actor = (state, seat = 0) => state.investigators[seat]
const cardOf = (state, id, seat = 0) => actor(state, seat).assets.find(card => card.id === id)
const enemyOf = (state, id) => state.enemies.find(card => card.id === id)
const react = (choice, code) => choice.options.find(item => item.cardCode === code)?.id
const legal = (state, predicate) => {
  const command = legalMoves(state, state.currentSeat).find(predicate)
  assert.ok(command, 'Expected a matching legal move')
  return command
}
const attack = (state, target) => legal(state, command => command.action === 'fight' && command.enemyId === target.id)
const evade = (state, target) => legal(state, command => command.action === 'evade' && command.enemyId === target.id)
const go = (state, locationId) => move(state, legal(state, command =>
  command.action === 'move' && command.locationId === locationId))

function connectedTable() {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  state.locations = [
    { id: 'a', name: '入口', revealed: true, shroud: 2, traits: [], clues: 0, connections: ['b'] },
    { id: 'b', name: '中央', revealed: true, shroud: 2, traits: [], clues: 0, connections: ['a', 'c'] },
    { id: 'c', name: '远处', revealed: true, shroud: 2, traits: [], clues: 0, connections: ['b'] },
  ]
  actor(state).location = 'a'
  actor(state, 1).location = 'a'
  return state
}

test('11052 把躲避失败边界提升为成功，保留交战，抽牌并横置来源', () => {
  const state = fixture('01001')
  const ally = asset(state, '11052')
  const target = enemy(state, { evade: actor(state).agility + 1, alert: false })
  const initialDeckSize = actor(state).deck.length
  let offered = false
  move(state, evade(state, target))
  settle(state, choice => {
    const response = react(choice, '11052')
    offered ||= response != null
    return response
  })
  assert.ok(offered)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.lastTestResult.value, state.lastTestResult.difficulty)
  assert.equal(enemyOf(state, target.id).engagedSeat, 0)
  assert.ok(enemyOf(state, target.id).exhausted)
  assert.ok(cardOf(state, ally.id).exhausted)
  assert.equal(actor(state).deck.length, initialDeckSize - 1)
  assert.equal(actor(state).hand.length, 1)
})

test('11052 对原无警戒的直立敌人，失败时仍触发本次警戒攻击', () => {
  const state = fixture('01001')
  asset(state, '11052')
  const target = enemy(state, { evade: actor(state).agility + 2, damage: 1, horror: 1, alert: false })
  move(state, evade(state, target))
  settle(state, choice => react(choice, '11052'))
  assert.equal(state.lastTestResult.success, false)
  assert.equal(enemyOf(state, target.id).alert, false)
  assert.equal(actor(state).damage, 1)
  assert.equal(actor(state).horror, 1)
  assert.equal(actor(state).hand.length, 0)
})

test('11064 花费选择的弹药，以同地点敌人战斗总值检定并分摊伤害', () => {
  const state = fixture('01001')
  const gun = asset(state, '11064')
  const first = enemy(state, { name: '第一敌人', fight: 3 })
  const second = enemy(state, { name: '第二敌人', fight: 4, engagedSeat: null })
  const sequence = [first.id, second.id, first.id]
  const command = legal(state, item => item.assetId === gun.id && item.targetId === first.id)
  move(state, command)
  settle(state, choice => {
    if (choice.kind === 'amount') return '3'
    if (choice.kind === 'assign-damage') return sequence.shift()
  })
  assert.equal(sequence.length, 0)
  assert.equal(cardOf(state, gun.id).uses, 9)
  assert.equal(state.lastTestResult.difficulty, 7)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(enemyOf(state, first.id).damageTaken, 2)
  assert.equal(enemyOf(state, second.id).damageTaken, 1)
})

test('11064 失败时只由所选攻击目标反击，且不分摊伤害', () => {
  const state = fixture('01001')
  const gun = asset(state, '11064')
  const first = enemy(state, { name: '目标敌人', fight: 4, damage: 1, retaliate: true })
  const second = enemy(state, { name: '旁观敌人', fight: 4, damage: 2, retaliate: true, engagedSeat: null })
  move(state, legal(state, item => item.assetId === gun.id && item.targetId === first.id))
  settle(state, choice => {
    assert.notEqual(choice.kind, 'assign-damage')
    if (choice.kind === 'amount') return '1'
  })
  assert.equal(state.lastTestResult.difficulty, 8)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(cardOf(state, gun.id).uses, 11)
  assert.equal(enemyOf(state, first.id).damageTaken, 0)
  assert.equal(enemyOf(state, second.id).damageTaken, 0)
  assert.equal(actor(state).damage, 1)
})

test('11053 合并查找遭遇牌库和弃牌堆，可选弃牌敌人并横置交战生成', () => {
  const state = fixture('01001')
  state.encounterDeck = ['ghoulPriest', 'ravenousGhoul', 'ancientEvils']
  state.encounterDiscard = ['ghoulMinion']
  const deckBefore = actor(state).deck.length
  let found = false
  play(state, '11053')
  settle(state, choice => {
    if (choice.kind !== 'search') return
    const candidates = choice.options.map(item => item.cardCode)
    assert.ok(candidates.includes('ravenousGhoul') && candidates.includes('ghoulMinion'))
    assert.ok(!candidates.includes('ghoulPriest'))
    found = true
    return choice.options.find(item => item.cardCode === 'ghoulMinion').id
  })
  assert.ok(found)
  const spawned = state.enemies.find(target => target.code === 'ghoulMinion')
  assert.ok(spawned?.exhausted)
  assert.equal(spawned.engagedSeat, 0)
  assert.equal(spawned.location, actor(state).location)
  assert.deepEqual(state.encounterDiscard, [])
  assert.deepEqual([...state.encounterDeck].sort(), ['ancientEvils', 'ghoulPriest', 'ravenousGhoul'])
  const definition = enemyDef('ghoulMinion')
  assert.equal(deckBefore - actor(state).deck.length, definition.damage + definition.horror)
})

test('11058 老剧本中远处敌人离开附属地点时，所属调查员回手并远程躲避它', () => {
  const state = connectedTable()
  assert.notEqual(state.scenario.eventWindowInstances, true)
  play(state, '11058')
  settle(state)
  assert.ok(state.playerLocationAttachments.some(card => card.code === '11058' && card.location === 'a'))
  actor(state).location = 'c'
  actor(state, 1).location = 'a'
  state.currentSeat = 1
  const target = enemy(state, { location: 'a', engagedSeat: 1, evade: 1 })
  let offered = false
  go(state, 'b')
  settle(state, choice => {
    const response = react(choice, '11058')
    if (response) {
      assert.equal(choice.seat, 0)
      offered = true
      return response
    }
    if (choice.options.some(option => option.id === 'evade')) return 'evade'
  })
  assert.ok(offered)
  assert.equal(actor(state).location, 'c')
  assert.ok(actor(state).hand.includes('11058'))
  assert.equal(state.playerLocationAttachments.some(card => card.code === '11058'), false)
  assert.equal(state.lastTestResult.seat, 0)
  assert.ok(enemyOf(state, target.id).exhausted)
  assert.equal(enemyOf(state, target.id).engagedSeat, null)
})

test('11109 进入后阻止与非精英交战，并且只阻止发动者本轮造成的伤害', () => {
  const state = connectedTable()
  const cloak = asset(state, '11109')
  const target = enemy(state, { location: 'b', engagedSeat: null, fight: 1 })
  go(state, 'b')
  settle(state, choice => react(choice, '11109'))
  assert.ok(cardOf(state, cloak.id).exhausted)
  assert.equal(enemyOf(state, target.id).engagedSeat, null)
  assert.ok(!legalMoves(state, 0).some(item => item.action === 'engage' && item.enemyId === target.id))
  move(state, attack(state, target))
  settle(state)
  assert.ok(state.lastTestResult.success)
  assert.equal(enemyOf(state, target.id).damageTaken, 0)
  actor(state, 1).location = 'b'
  state.currentSeat = 1
  move(state, attack(state, target))
  settle(state)
  assert.equal(enemyOf(state, target.id).damageTaken, 1)
  state.round += 1
  state.currentSeat = 0
  move(state, attack(state, target))
  settle(state)
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
})

test('11027 当回合第一次调查免于借机攻击，发现线索后的反应可造成伤害', () => {
  const state = fixture('01001')
  const ally = asset(state, '11027')
  const target = enemy(state, { damage: 1 })
  const location = state.locations.find(item => item.id === actor(state).location)
  location.clues = 2
  location.shroud = actor(state).intellect + 1
  const investigate = () => legal(state, item => item.action === 'investigate')
  move(state, investigate())
  settle(state, choice => react(choice, '11027'))
  assert.ok(state.lastTestResult.success)
  assert.equal(actor(state).damage, 0)
  assert.equal(enemyOf(state, target.id).damageTaken, 1)
  assert.ok(cardOf(state, ally.id).exhausted)
  move(state, investigate())
  settle(state)
  assert.equal(actor(state).damage, 1)
})

test('11030 枪械打出时多获得一个弹药，普通支援的使用次数保持原量', () => {
  const state = fixture('01001')
  asset(state, '11030')
  play(state, '01016')
  settle(state)
  assert.equal(actor(state).assets.find(card => card.code === '01016')?.uses, 5)
  play(state, '01019')
  settle(state)
  assert.equal(actor(state).assets.find(card => card.code === '01019')?.uses, 3)
})

test('11058 老剧本中敌人进入附属地点后，所有者可从不相连地点立即移动过去', () => {
  const state = connectedTable()
  play(state, '11058')
  settle(state)
  actor(state).location = 'c'
  actor(state, 1).location = 'b'
  state.currentSeat = 1
  enemy(state, { location: 'b', engagedSeat: 1 })
  go(state, 'a')
  settle(state, choice => {
    const response = react(choice, '11058')
    if (response) {
      assert.equal(choice.seat, 0)
      return response
    }
    if (choice.options.some(option => option.id === 'move')) return 'move'
  })
  assert.equal(actor(state).location, 'a')
  assert.ok(actor(state).hand.includes('11058'))
  assert.equal(state.playerLocationAttachments.some(card => card.code === '11058'), false)
})

test('11022 离场时零弹药仍可发动攻击，且离场实体仅弃置一次', () => {
  const state = fixture('01001')
  const gun = asset(state, '11022', { uses: 0 })
  asset(state, '01020')
  const target = enemy(state, { fight: actor(state).combat + 1 })
  play(state, '01016')
  settle(state, choice => react(choice, '11022'))
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
  assert.equal(cardOf(state, gun.id), undefined)
  assert.equal(actor(state).discard.filter(code => code === '11022').length, 1)
})

test('11050 免费攻击消耗一枚弹药，装填费用为一个行动和一个资源', () => {
  const state = fixture('01001')
  const gun = asset(state, '11050')
  const target = enemy(state)
  const startingActions = actor(state).actionsLeft
  const startingResources = actor(state).resources
  move(state, legal(state, item => item.assetId === gun.id && item.targetId === target.id))
  settle(state)
  assert.equal(actor(state).actionsLeft, startingActions)
  assert.equal(enemyOf(state, target.id).damageTaken, 1)
  assert.equal(cardOf(state, gun.id).uses, 1)
  assert.ok(cardOf(state, gun.id).exhausted)
  move(state, legal(state, item => item.assetId === gun.id && item.abilityIndex === 1))
  settle(state)
  assert.equal(actor(state).actionsLeft, startingActions - 1)
  assert.equal(actor(state).resources, startingResources - 1)
  assert.equal(cardOf(state, gun.id).uses, 2)
  assert.equal(cardOf(state, gun.id).exhausted, false)
})

test('11059 在非法支援被弃置时盖放该卡，随后支付资源抽回原牌', () => {
  const state = fixture('01001')
  const broker = asset(state, '11059')
  const illicit = asset(state, '01044')
  asset(state, '01020')
  play(state, '01016')
  settle(state, choice => react(choice, '11059'))
  assert.equal(cardOf(state, illicit.id), undefined)
  assert.ok(!actor(state).discard.includes('01044'))
  const attachment = cardOf(state, broker.id).attachments.find(card => card.code === '01044')
  assert.equal(attachment?.facedown, true)
  const start = actor(state).resources
  move(state, legal(state, item => item.assetId === broker.id && item.abilityIndex === 0))
  settle(state)
  assert.equal(actor(state).resources, start - 2)
  assert.deepEqual(actor(state).hand, ['01044'])
  assert.deepEqual(cardOf(state, broker.id).attachments, [])
})

test('11020 回合结束时返还刚弃置的策略事件，保留弃牌堆旧同码副本', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const book = asset(state, '11020')
  const target = enemy(state, { exhausted: true })
  actor(state).discard = ['01052']
  play(state, '01052')
  settle(state, choice => react(choice, '11020'))
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
  assert.equal(cardOf(state, book.id).uses, 2)
  assert.ok(cardOf(state, book.id).exhausted)
  assert.deepEqual(actor(state).hand, [])
  assert.deepEqual(actor(state).discard, ['01052', '01052'])
  move(state, { action: 'endTurn' })
  settle(state)
  assert.deepEqual(actor(state).hand, ['01052'])
  assert.deepEqual(actor(state).discard, ['01052'])
})


test('11056 成功谈判按剩余生命检定，可将非精英洗回或伤害精英', () => {
  const state = fixture('01001')
  const first = enemy(state, { health: 3, damageTaken: 2, damage: 1 })
  const elite = enemy(state, { name: '精英敌人', code: 'ghoulPriest', elite: true, health: 6, damageTaken: 3, engagedSeat: null })
  play(state, '11056')
  settle(state, choice => choice.options.some(item => item.id === first.id) ? first.id : null)
  assert.equal(state.lastTestResult.difficulty, 1)
  assert.ok(state.lastTestResult.success)
  assert.equal(actor(state).damage, 0)
  assert.equal(enemyOf(state, first.id), undefined)
  assert.equal(state.encounterDeck.filter(code => code === first.code).length, 1)
  play(state, '11056')
  settle(state)
  assert.equal(state.lastTestResult.difficulty, 3)
  assert.ok(state.lastTestResult.success)
  assert.equal(enemyOf(state, elite.id).damageTaken, 5)
})

test('11063 连接地点受伤者转交资源，取消对应数量的伤害与恐惧', () => {
  const state = connectedTable()
  actor(state, 1).location = 'b'
  actor(state).hand = ['11063']
  actor(state, 1).resources = 3
  const start = actor(state).resources
  state.currentSeat = 1
  enemy(state, { location: 'b', engagedSeat: 1, damage: 1, horror: 3 })
  move(state, { action: 'resource' })
  settle(state, choice => {
    const response = react(choice, '11063')
    if (response) return response
    if (choice.options.some(item => item.id === '1:2')) {
      assert.equal(choice.seat, 1)
      return '1:2'
    }
  })
  assert.equal(actor(state).resources, start + 3)
  assert.equal(actor(state, 1).resources, 1)
  assert.equal(actor(state, 1).damage, 0)
  assert.equal(actor(state, 1).horror, 1)
  assert.ok(actor(state).discard.includes('11063'))
})

test('11099 满手槽时仍可令手牌书籍实际入场，回合结束放在牌库底', () => {
  const state = fixture('01002', 2)
  state.humanSeats = [0, 1]
  const pass = asset(state, '11099')
  asset(state, '01016')
  asset(state, '01020')
  actor(state).hand = ['01031']
  const initialResources = actor(state).resources
  const initialActions = actor(state).actionsLeft
  move(state, legal(state, item => item.assetId === pass.id && item.abilityIndex === 0))
  settle(state)
  const tome = actor(state).assets.find(card => card.code === '01031')
  assert.ok(tome)
  assert.equal(tome.attachedToAsset, pass.id)
  assert.equal(actor(state).assets.length, 4)
  assert.equal(actor(state).resources, initialResources - 1)
  assert.equal(actor(state).actionsLeft, initialActions)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(cardOf(state, tome.id), undefined)
  assert.equal(actor(state).deck[0], '01031')
  assert.ok(!actor(state).discard.includes('01031'))
})

test('11023 首次行动折扣打出新枪，升级优先落到实际新枪', () => {
  const state = fixture('01001')
  const previousGun = asset(state, '01016')
  actor(state).hand = ['01016', '04193']
  const initialResources = actor(state).resources
  const initialActions = actor(state).actionsLeft
  play(state, '11023')
  settle(state, choice => react(choice, '04193'))
  const newGun = actor(state).assets.find(card => card.code === '01016' && card.id !== previousGun.id)
  assert.ok(newGun)
  assert.ok(newGun.attachments.some(card => card.code === '04193'))
  assert.ok(!cardOf(state, previousGun.id).attachments?.length)
  assert.equal(actor(state).actionsLeft, initialActions - 1)
  assert.equal(actor(state).resources, initialResources - 5)
})

test('11026 攻击被标记敌人获得战斗加值，另一位调查员可弃标记追加伤害', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  actor(state, 1).location = actor(state).location
  const target = enemy(state, { fight: actor(state).combat + 1 })
  play(state, '11026')
  settle(state)
  assert.ok(enemyOf(state, target.id).attachments.some(card => card.code === '11026'))
  move(state, attack(state, target))
  settle(state, choice => choice.seat === 1 ? react(choice, '11026') : null)
  assert.ok(state.lastTestResult.success)
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
  assert.deepEqual(enemyOf(state, target.id).attachments, [])
  assert.ok(actor(state).discard.includes('11026'))
})

test('11031 只用抽牌反应免费打出刚抽到的副本并保留原手牌顺序', () => {
  const state = fixture('01001')
  const target = enemy(state, { engagedSeat: null })
  actor(state).resources = 0
  actor(state).hand = ['11031', '01088']
  actor(state).deck.push('11031')
  assert.ok(!legalMoves(state).some(item => item.action === 'play' && item.cardId === '11031'))
  move(state, { action: 'draw' })
  settle(state, choice => react(choice, '11031'))
  assert.equal(enemyOf(state, target.id).damageTaken, 1)
  assert.equal(actor(state).resources, 0)
  assert.deepEqual(actor(state).hand, ['11031', '01088'])
  assert.deepEqual(actor(state).discard, ['11031'])
})


test('11020 回合末返手可跟踪更早的弃牌被拾取后发生的索引移动', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  asset(state, '11020')
  asset(state, '01073')
  enemy(state, { exhausted: true })
  const location = state.locations.find(item => item.id === actor(state).location)
  location.shroud = 1
  location.clues = 1
  actor(state).discard = ['01020', '01052']
  play(state, '01052')
  settle(state, choice => react(choice, '11020'))
  move(state, legal(state, item => item.action === 'investigate'))
  settle(state, choice => {
    if (choice.prompt.includes('拾荒') && choice.options.some(item => item.id === 'trigger')) return 'trigger'
    return react(choice, '01020')
  })
  assert.deepEqual(actor(state).hand, ['01020'])
  move(state, { action: 'endTurn' })
  settle(state)
  assert.deepEqual(actor(state).hand, ['01020', '01052'])
  assert.deepEqual(actor(state).discard, ['01052'])
})


test('11031 一次抽牌效果抽到同码两张时，每张各有一次折扣反应', () => {
  const state = fixture('01001')
  actor(state).resources = 2
  actor(state).hand = ['11031']
  actor(state).deck.push('01088', '11031', '11031')
  const location = state.locations.find(item => item.id === actor(state).location)
  location.clues = 2
  const target = enemy(state, { engagedSeat: null })
  let offered = 0
  play(state, '02186')
  settle(state, choice => {
    const matches = choice.options.filter(item => item.cardCode === '11031')
    if (!matches.length) return
    assert.equal(matches.length, 1)
    offered++
    return matches[0].id
  })
  assert.equal(offered, 2)
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
  assert.deepEqual(actor(state).hand, ['11031', '01088'])
  assert.equal(actor(state).discard.filter(code => code === '11031').length, 2)
})


test('11028 入场封印，在借机攻击时释放封印取消攻击并重整另一支援，击败敌人后可再封印', () => {
  const state = fixture('01001')
  state.chaosBag = ['0', '+1']
  const other = asset(state, '01019', { exhausted: true })
  play(state, '11028')
  settle(state)
  const bulwark = actor(state).assets.find(card => card.code === '11028')
  assert.ok(bulwark)
  assert.deepEqual(state.chaosBag, ['0'])
  const target = enemy(state, { health: 1, damage: 1, horror: 1 })
  move(state, { action: 'resource' })
  settle(state, choice => react(choice, '11028'))
  assert.ok(cardOf(state, bulwark.id).exhausted)
  assert.equal(cardOf(state, other.id).exhausted, false)
  assert.equal(actor(state).damage, 0)
  assert.equal(actor(state).horror, 0)
  assert.ok(state.chaosBag.includes('+1'))
  state.debugNextTokens = ['0']
  move(state, attack(state, target))
  settle(state, choice => react(choice, '11028'))
  assert.equal(enemyOf(state, target.id), undefined)
  assert.ok(state.chaos.sealed.some(entry => entry.source === bulwark.id && entry.token === '+1'))
})

test('11032 入场和离场都可忽略行动与弹药执行攻击', () => {
  const state = fixture('01001')
  const target = enemy(state, { fight: actor(state).combat + 2 })
  const select = choice => react(choice, '11032')
  play(state, '11032')
  settle(state, select)
  const gun = actor(state).assets.find(card => card.code === '11032')
  assert.ok(gun)
  assert.equal(gun.uses, 3)
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
  asset(state, '01020')
  play(state, '01016')
  settle(state, select)
  assert.equal(cardOf(state, gun.id), undefined)
  assert.equal(enemyOf(state, target.id).damageTaken, 4)
  assert.equal(actor(state).discard.filter(code => code === '11032').length, 1)
})

test('11054 连接地点受伤者自己的支付取消伤害与恐惧，事件拥有者不获得资源', () => {
  const state = connectedTable()
  actor(state, 1).location = 'b'
  state.currentSeat = 1
  actor(state).hand = ['11054']
  actor(state, 1).resources = 3
  const start = actor(state).resources
  enemy(state, { location: 'b', engagedSeat: 1, damage: 1, horror: 3 })
  move(state, { action: 'resource' })
  settle(state, choice => {
    const response = react(choice, '11054')
    if (response) return response
    if (choice.options.some(item => item.id === '1:2')) {
      assert.equal(choice.seat, 1)
      return '1:2'
    }
  })
  assert.equal(actor(state).resources, start)
  assert.equal(actor(state, 1).resources, 1)
  assert.equal(actor(state, 1).damage, 0)
  assert.equal(actor(state, 1).horror, 1)
  assert.ok(actor(state).discard.includes('11054'))
})

test('11055 将战斗加入躲避检定，达成成功差值后先伤害再移动非精英敌人', () => {
  const state = connectedTable()
  const target = enemy(state, { evade: actor(state).agility + actor(state).combat - 2 })
  play(state, '11055')
  settle(state, choice => {
    if (choice.kind === 'move' && choice.options.some(item => item.id === 'b')) return 'b'
  })
  assert.equal(state.lastTestResult.successBy, 2)
  assert.equal(enemyOf(state, target.id).damageTaken, 1)
  assert.equal(enemyOf(state, target.id).location, 'b')
  assert.equal(enemyOf(state, target.id).engagedSeat, null)
  assert.ok(enemyOf(state, target.id).exhausted)
})

test('11061 押注费用与成功差值门槛，刚好成功无回报，超过一点获双倍资源', () => {
  for (const margin of [0, 1]) {
    const state = fixture('01001')
    actor(state).hand = ['11061']
    const target = enemy(state, { fight: actor(state).combat + 3 - margin })
    const start = actor(state).resources
    move(state, attack(state, target))
    settle(state, choice => {
      if (choice.kind === 'resource' && choice.options.some(item => item.id === '2')) return '2'
      if (choice.kind === 'commit' && choice.options.some(item => item.id === '0')) return '0'
    })
    assert.ok(state.lastTestResult.success)
    assert.equal(state.lastTestResult.successBy, margin)
    assert.equal(actor(state).resources, start - 2 + (margin > 0 ? 4 : 0))
    assert.ok(actor(state).discard.includes('11061'))
  }
})

test('11096 同地点另一调查员在自己的回合之外照付费用，连续打出小憩', () => {
  const state = connectedTable()
  actor(state).damage = 1
  actor(state).horror = 1
  actor(state, 1).hand = ['11096']
  const start = state.investigators.map(inv => ({ actions: inv.actionsLeft, resources: inv.resources }))
  let offered = false
  play(state, '11096')
  settle(state, choice => {
    const response = react(choice, '11096')
    if (response && choice.seat === 1) {
      offered = true
      return response
    }
    if (choice.kind === 'heal' && choice.options.some(item => item.id === 'damage')) return 'damage'
  })
  assert.ok(offered)
  assert.equal(actor(state).damage, 0)
  assert.equal(actor(state).horror, 0)
  for (const inv of state.investigators) {
    assert.equal(inv.resources, start[inv.seat].resources - 1)
    assert.equal(inv.actionsLeft, start[inv.seat].actions - (inv.seat === 0 ? 1 : 0))
    assert.ok(inv.discard.includes('11096'))
  }
})


test('11025 本轮成功攻击使第二次攻击投入获得两枚额外图标，下一轮清除', () => {
  const state = fixture('01001')
  actor(state).hand = ['11025']
  const first = enemy(state)
  move(state, attack(state, first))
  settle(state)
  assert.ok(state.lastTestResult.success)
  const threshold = actor(state).combat + 4
  const second = enemy(state, { fight: threshold })
  const commit = choice => choice.kind === 'commit' && choice.options.some(option => option.id === '0') ? '0' : null
  move(state, attack(state, second))
  settle(state, commit)
  assert.equal(state.lastTestResult.value, threshold)
  assert.ok(state.lastTestResult.success)
  state.round++
  actor(state).hand = ['11025']
  move(state, attack(state, second))
  settle(state, commit)
  assert.equal(state.lastTestResult.value, threshold - 2)
  assert.equal(state.lastTestResult.success, false)
})

test('11051 弃置真实手枪后仍打开枪械响应，并可将攻击改指连接地点', () => {
  const state = connectedTable()
  const ally = asset(state, '11051')
  actor(state).hand = ['01016', '04104']
  const local = enemy(state, { damage: 1 })
  const remote = enemy(state, { location: 'b', engagedSeat: null, fight: actor(state).combat + 2 })
  const initialResources = actor(state).resources
  const initialActions = actor(state).actionsLeft
  let offered = false
  move(state, legal(state, item => item.action === 'ability' && item.assetId === ally.id))
  settle(state, choice => {
    const response = react(choice, '04104')
    offered ||= response != null
    return response
  })
  assert.ok(offered)
  assert.equal(state.lastTestResult.source.enemyId, remote.id)
  assert.equal(enemyOf(state, local.id).damageTaken, 0)
  assert.equal(enemyOf(state, remote.id).damageTaken, 3)
  assert.equal(actor(state).actionsLeft, initialActions - 1)
  assert.equal(actor(state).resources, initialResources - 2)
  assert.equal(actor(state).damage, 0)
  assert.ok(cardOf(state, ally.id).exhausted)
  assert.ok(actor(state).discard.includes('01016'))
  assert.ok(!actor(state).assets.some(card => card.code === '01016'))
})

test('11057 普通攻击不可投入，控制的枪械印刷能力发起时可以投入', () => {
  const state = fixture('01001')
  const gun = asset(state, '01016')
  const target = enemy(state, { fight: actor(state).combat + 4 })
  actor(state).hand = ['11057']
  move(state, attack(state, target))
  settle(state, choice => {
    if (choice.kind === 'commit') assert.ok(!choice.options.some(option => option.id === '0'))
  })
  assert.equal(state.lastTestResult.success, false)
  assert.deepEqual(actor(state).hand, ['11057'])
  move(state, legal(state, item => item.action === 'ability' && item.assetId === gun.id))
  settle(state, choice => choice.kind === 'commit' && choice.options.some(option => option.id === '0') ? '0' : null)
  assert.equal(state.lastTestResult.source.assetId, gun.id)
  assert.ok(state.lastTestResult.success)
  assert.equal(enemyOf(state, target.id).damageTaken, 2)
  assert.ok(actor(state).discard.includes('11057'))
})

test('11060 与敌人交战后释放封印按帷幕攻击，揭示新地点后重新封印', () => {
  const state = connectedTable()
  const location = state.locations.find(item => item.id === 'a')
  location.shroud = 6
  play(state, '11060')
  settle(state)
  const source = actor(state).assets.find(card => card.code === '11060')
  assert.ok(source)
  assert.ok(state.chaos.sealed.some(entry => entry.source === source.id && entry.token === '0'))
  const target = enemy(state, { engagedSeat: null, fight: 6 })
  const initialActions = actor(state).actionsLeft
  move(state, legal(state, item => item.action === 'engage' && item.enemyId === target.id))
  settle(state, choice => {
    if (choice.options.some(item => item.id === 'fight')) return 'fight'
    return react(choice, '11060')
  })
  assert.equal(state.lastTestResult.value, 6)
  assert.equal(enemyOf(state, target.id).damageTaken, 1)
  assert.equal(actor(state).actionsLeft, initialActions - 1)
  assert.ok(cardOf(state, source.id).exhausted)
  assert.ok(!state.chaos.sealed.some(entry => entry.source === source.id))
  state.locations.find(item => item.id === 'b').revealed = false
  go(state, 'b')
  settle(state, choice => react(choice, '11060'))
  assert.ok(state.chaos.sealed.some(entry => entry.source === source.id && entry.token === '0'))
})

test('11062 展示手枪的攻击无费用，之后可弃掉抽牌或支付费用装备', () => {
  for (const suffix of ['discard', 'play']) {
    const state = fixture('01001')
    const ally = asset(state, '11062')
    actor(state).hand = ['01016']
    const target = enemy(state, { fight: actor(state).combat + 2, damage: 1 })
    const initialActions = actor(state).actionsLeft
    const initialResources = actor(state).resources
    const initialDeck = actor(state).deck.length
    move(state, legal(state, item => item.action === 'ability' && item.assetId === ally.id))
    settle(state, choice => choice.options.some(item => item.id === suffix) ? suffix : null)
    assert.ok(state.lastTestResult.success)
    assert.equal(enemyOf(state, target.id).damageTaken, 2)
    assert.equal(actor(state).actionsLeft, initialActions)
    assert.equal(actor(state).damage, 0)
    assert.ok(cardOf(state, ally.id).exhausted)
    if (suffix === 'discard') {
      assert.equal(actor(state).resources, initialResources)
      assert.equal(actor(state).deck.length, initialDeck - 1)
      assert.deepEqual(actor(state).hand, ['01088'])
      assert.ok(actor(state).discard.includes('01016'))
    } else {
      const gun = actor(state).assets.find(card => card.code === '01016')
      assert.ok(gun)
      assert.equal(gun.uses, 4)
      assert.equal(actor(state).resources, initialResources - 4)
      assert.deepEqual(actor(state).hand, [])
    }
  }
})

