// 09-a-10（TSK · tskc 09737–09770b）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import { asset, enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { enemyEvadeValue, enemyFightValue, reactionWindow, scenarioRuntime, spawnEnemy } from '../src/engine/engine.js'
import { enemyIsAloof } from '../src/engine/enemy-aloof.js'

import paradigm from '../src/cards/encounter-entries/theScarletKeys/_shared/agents_of_the_outside/09737.js'
import splintered from '../src/cards/encounter-entries/theScarletKeys/_shared/spatial_anomaly/09741.js'
import beyond from '../src/cards/encounter-entries/theScarletKeys/_shared/spatial_anomaly/09742.js'
import warped from '../src/cards/encounter-entries/theScarletKeys/_shared/spatial_anomaly/09743.js'
import touch from '../src/cards/encounter-entries/theScarletKeys/_shared/spreading_corruption/09744.js'
import terror from '../src/cards/encounter-entries/theScarletKeys/_shared/beyond_the_beyond/09751.js'

test('验收 09737/09741/09742/09743/09744 域外使徒/空间异常：真实显现与强制能力结算', () => {
  // 09737：回合结束 → 牌库顶非弱点成为空洞；空洞≥3 时攻击。
  assert.equal(paradigm.code, '09737')
  const ability = paradigm.abilities[0]
  assert.equal(ability.trigger, 'turnEnded')
  const calls = []
  const inv = { seat: 0, location: 'loc', deck: ['01020'], defeated: false, resigned: false }
  const enemy = { id: 'e1', code: '09737', location: 'loc' }
  const state = { enemies: [enemy], investigators: [inv] }
  const api = {
    info: () => {}, cardName: code => code,
    takeDeckCard: (seat, code) => calls.push(['takeDeckCard', seat, code]),
    mechanics: { tsk: { hollow: { isHollowed: () => false, hollow: card => calls.push(['hollow', card.code]), count: () => 3 } } },
    scenario: { attack: (source, target) => calls.push(['attack', source.code, target.seat]) },
  }
  assert.equal(ability.criteria({ state, source: enemy, context: { seat: 0, location: 'loc' } }), true)
  ability.resolve({ state, source: enemy, context: { seat: 0 }, api })
  assert.deepEqual(calls[0], ['takeDeckCard', 0, '01020'], '09737 牌库顶实体取出')
  assert.equal(calls.some(call => call[0] === 'hollow'), true, '09737 成为空洞')
  assert.equal(calls.some(call => call[0] === 'attack' && call[2] === 0), true, '09737 3+ 空洞时攻击')

  // 09741/09742：附属到地点 + 检定；失败按 Hex 数量扣血/恐惧。
  for (const entry of [splintered, beyond]) {
    const state2 = { investigators: [{ seat: 0, location: 'loc2' }], locations: [{ id: 'loc2', attachments: [] }] }
    const calls2 = []
    const api2 = {
      info: () => {}, locationName: () => 'loc2',
      attachToLocation: (id, spec) => { state2.locations[0].attachments.push({ ...spec, id: 'a1' }); calls2.push(['attach', id]) },
      test: (seat, skill, difficulty, cb) => { calls2.push(['test', seat, skill, difficulty]); cb({ success: false }) },
      damage: (seat, amount) => calls2.push(['damage', seat, amount]),
      horror: (seat, amount) => calls2.push(['horror', seat, amount]),
      detachLocationAttachment: () => calls2.push(['detach']),
    }
    const result = entry.encounterResolve(state2, state2.investigators[0], { code: entry.code }, api2)
    assert.deepEqual(result, { placed: true }, `${entry.code} 已作为地点附属入场`)
    assert.ok(calls2.some(call => call[0] === 'attach'), `${entry.code} 附属到地点`)
    assert.ok(calls2.some(call => call[0] === 'test'), `${entry.code} 显现检定`)
  }
  assert.equal(typeof warped.encounterResolve, 'function', '09743 显现结算入口')
  assert.equal(typeof touch.encounterResolve, 'function', '09744 显现结算入口')
  for (const entry of [warped, touch]) assert.match(String(entry.note || ''), /无缺读点|已接线/, `${entry.code} 无未读点声明`)
})

test('验收 09745 突来冲动：符号标记限制首个行动，两行动弃置后恢复', () => {
  const state = fixture()
  const inv = state.investigators[0]
  state.turnSerial = 1
  state.chaosBag = ['skull']
  scenarioRuntime(state, []).threat(0, '09745')
  const threat = inv.threat.find(card => card.code === '09745')
  reactionWindow(state, 'turnBegins', { when: 'turnBegins', seat: 0, location: inv.location }, [])
  assert.equal(threat.requiredActionTurn, 1)
  assert.match(validateMove(state, 0, { action: 'resource' }), /第一个行动/)
  const discard = legalMoves(state).find(command => command.entityId === threat.id)
  assert.ok(discard)
  const before = inv.actionsLeft
  move(state, discard)
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, before - 2)
  assert.equal(state.investigators[0].threat.some(card => card.id === threat.id), false)
  assert.equal(validateMove(state, 0, { action: 'resource' }), null)
})

test('验收 09746 理智扭曲：禁止连续同类行动，交替行动后可再次执行', () => {
  const state = fixture()
  state.turnSerial = 1
  scenarioRuntime(state, []).threat(0, '09746')
  move(state, { action: 'resource' }); settle(state)
  assert.match(validateMove(state, 0, { action: 'resource' }), /不能连续/)
  assert.equal(legalMoves(state).some(command => command.action === 'resource'), false)
  move(state, { action: 'draw' }); settle(state)
  assert.equal(validateMove(state, 0, { action: 'resource' }), null)
})

test('验收 09738 物质颠倒：附属期间提高攻防数值并失去冷漠，失败攻击时反击', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const host = enemy(state, { fight: 99, evade: 2, traits: ['Outsider'], aloof: true, damage: 1 })
  const api = scenarioRuntime(state, [])
  api.drawEncounter(0, { code: '09738' })
  assert.equal(host.attachments[0].code, '09738')
  assert.equal(enemyFightValue(state, host, inv), 100)
  assert.equal(enemyEvadeValue(state, host, inv), 3)
  assert.equal(enemyIsAloof(state, host), false)
  const before = inv.damage
  move(state, { action: 'fight', enemyId: host.id })
  settle(state)
  assert.equal(state.investigators[0].damage, before + 1)
  const live = state.enemies.find(item => item.id === host.id)
  api.discardAttachment(live.attachments[0])
  assert.equal(enemyIsAloof(state, live), true)
  assert.equal(enemyEvadeValue(state, live, state.investigators[0]), 2)
})

test('验收 09739 犹格斯密使：入场结算隐匿 2，并在阴影中因发现线索攻击调查员', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const api = scenarioRuntime(state, [])
  const target = spawnEnemy(state, '09739', inv.location, null)
  assert.equal(target.location, null)
  const minis = api.mechanics.tsk.concealed.miniCards()
  assert.equal(minis.filter(card => card.decoy).length, 2)
  assert.equal(minis.filter(card => card.code === '09739').length, 1)
  const before = inv.damage + inv.horror
  reactionWindow(state, 'clueDiscovered', {
    when: 'clueDiscovered', seat: 0, location: inv.location, amount: 1,
  }, [])
  assert.ok(inv.damage + inv.horror > before)
})

for (const code of ['09747a', '09747b', '09747c']) {
  test(`验收 ${code} 凌乱道路：攻击和躲避难度 +2，0 距离花费 0 资源并按座位查看`, () => {
    const state = fixture()
    const inv = state.investigators[0]
    const location = state.locations.find(item => item.id === inv.location)
    Object.assign(location, { originalCode: code, revealed: true, shroud: 1 })
    const concealed = scenarioRuntime(state, []).mechanics.tsk.concealed
    const card = concealed.place({ kind: 'decoy', decoy: true, locationId: inv.location })
    for (const action of ['fightConcealed', 'evadeConcealed']) {
      const command = legalMoves(state).find(item => item.action === action && item.miniId === card.id)
      assert.ok(command?.label.includes('vs 3'))
    }
    const before = inv.resources
    const command = legalMoves(state).find(item => item.action === 'entityAbility' && item.entityId === location.id)
    assert.ok(command)
    move(state, command)
    settle(state)
    assert.equal(state.investigators[0].resources, before)
    assert.deepEqual(concealed.byId(card.id).knownBy, [0])
    assert.equal(concealed.projection({ observerSeat: 1 })[0].visible, false)
    assert.equal(legalMoves(state).some(item => item.action === 'entityAbility' && item.entityId === location.id), false)
  })
}

for (const code of ['09748a', '09748b']) {
  test(`验收 ${code} 异星边境：真实查看异界顶牌，仅执行者收到牌面，牌库顺序不变`, () => {
    const state = fixture()
    const inv = state.investigators[0]
    const location = state.locations.find(item => item.id === inv.location)
    Object.assign(location, { originalCode: code, revealed: true })
    const decks = scenarioRuntime(state, []).mechanics.scenarioDecks
    decks.initialize('otherworld', ['09747a', '09750'], { shuffle: false })
    const command = legalMoves(state).find(item => item.action === 'entityAbility' && item.entityId === location.id)
    assert.ok(command)
    const events = move(state, command)
    settle(state)
    const peek = events.find(event => event.presentation?.code === '09750')
    assert.equal(peek.privateSeat, 0)
    assert.equal(state.log.some(line => line.includes('疯狂峭壁')), false)
    assert.deepEqual(decks.top('otherworld', 2), ['09750', '09747a'])
  })
}

test('验收 09751 超维恐怖：翻开诱饵，再把同样数量的迷你卡盖回原位置', () => {
  const state = fixture()
  const locationId = state.investigators[0].location
  const other = { id: 'other', name: '另一地点' }
  state.locations.push(other)
  const api = scenarioRuntime(state, [])
  const concealed = api.mechanics.tsk.concealed
  concealed.place({ kind: 'decoy', decoy: true, locationId, knownBy: [0] })
  concealed.place({ kind: 'real', code: '09747a', locationId: other.id })
  terror.encounterResolve(state, state.investigators[0], { code: '09751' }, { ...api, choice: () => 'decoys' })
  const after = concealed.miniCards()
  assert.deepEqual(after.map(card => card.locationId), [locationId, other.id])
  assert.ok(after.every(card => !card.flipped && card.knownBy.length === 0))
  assert.ok(state.log.some(line => line.includes('翻开了 1 张诱饵')))
})

test('验收 09749a 拟像旷野：仅交换所选两张迷你卡的格子，第三张留在原位', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const here = state.locations.find(item => item.id === inv.location)
  Object.assign(here, { originalCode: '09749a', revealed: true, clues: 0 })
  const api = scenarioRuntime(state, [])
  const concealed = api.mechanics.tsk.concealed
  const minis = [1, 2, 3].map(index => concealed.place({ kind: `card${index}`, locationId: here.id }))
  const positions = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
  state.scenarioFlags.withoutATrace = {
    shadows: {}, spots: Object.fromEntries(minis.map((card, index) => [card.id, positions[index]])),
  }
  const command = legalMoves(state).find(item => item.action === 'entityAbility' && item.entityId === here.id)
  assert.ok(command)
  move(state, command)
  const picked = [minis[0].id, minis[2].id]
  settle(state, choice => choice.options.find(option => picked.includes(option.id))?.id)
  const spots = state.scenarioFlags.withoutATrace.spots
  assert.deepEqual(minis.map(card => spots[card.id]), [positions[2], positions[1], positions[0]])
})

test('验收 09749b 拟像旷野：交换两个阴影地点，更新对应迷你卡身份和位置归属', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const here = state.locations.find(item => item.id === inv.location)
  Object.assign(here, { originalCode: '09749b', revealed: true, clues: 0 })
  state.locations.push({ id: 'shadowA', originalCode: '09747a' }, { id: 'shadowB', originalCode: '09748b' })
  const concealed = scenarioRuntime(state, []).mechanics.tsk.concealed
  const left = concealed.place({ kind: 'CityOfRemnantsL', locationId: here.id, code: '09747a' })
  const middle = concealed.place({ kind: 'CityOfRemnantsM', locationId: here.id, code: '09748b' })
  state.scenarioFlags.withoutATrace = { shadows: { left: 'shadowA', middle: 'shadowB' }, spots: {} }
  const command = legalMoves(state).find(item => item.action === 'entityAbility' && item.entityId === here.id)
  assert.ok(command)
  move(state, command)
  settle(state)
  assert.deepEqual(state.scenarioFlags.withoutATrace.shadows, { left: 'shadowB', middle: 'shadowA' })
  assert.equal(concealed.byId(left.id).code, '09748b')
  assert.equal(concealed.byId(middle.id).code, '09747a')
})

test('验收 09750 疯狂峭壁：揭示后只移动相邻迷你卡，并把它们分到不同空位', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const here = state.locations.find(item => item.id === inv.location)
  const cliff = { id: 'cliff', originalCode: '09750', name: '疯狂峭壁', revealed: false, shroud: 3, clues: 0, connections: [here.id] }
  const other = { id: 'other', name: '另一地点', revealed: true, shroud: 1, clues: 0, connections: [] }
  state.locations.push(cliff, other)
  here.connections.push(cliff.id)
  state.scenarioFlags.mechanics = { grid: {
    [here.id]: { x: -1, y: 0 }, [cliff.id]: { x: 0, y: 0 }, [other.id]: { x: 3, y: 0 },
  } }
  const concealed = scenarioRuntime(state, []).mechanics.tsk.concealed
  const [first, second, unaffected] = ['one', 'two', 'three'].map(kind => concealed.place({ kind, locationId: here.id }))
  const original = {
    [first.id]: { x: 0, y: -1 }, [second.id]: { x: 1, y: 0 }, [unaffected.id]: { x: 3, y: 1 },
  }
  state.scenarioFlags.withoutATrace = { shadows: {}, spots: { ...original } }
  move(state, { action: 'move', locationId: cliff.id })
  settle(state)
  const { spots } = state.scenarioFlags.withoutATrace
  for (const id of [first.id, second.id]) assert.notDeepEqual(spots[id], original[id])
  assert.notDeepEqual(spots[first.id], spots[second.id])
  assert.deepEqual(spots[unaffected.id], original[unaffected.id])
})

test('验收 09759 苋：攻击恐惧分配给尚未达到理智上限的支援，也击败该支援', () => {
  const state = fixture()
  const ally = asset(state, '01033')
  enemy(state, { code: '09759', damage: 0, horror: 1, name: '苋' })
  move(state, { action: 'endTurn' })
  settle(state, choice => choice.kind === 'assign-horror' && choice.options.some(option => option.id === ally.id)
    ? ally.id : null)
  assert.equal(state.investigators[0].assets.some(item => item.id === ally.id), false)
  assert.ok(state.investigators[0].discard.includes('01033'))
  assert.ok(state.log.some(line => line.includes('苋') && line.includes('击败了接受伤害或恐惧的支援')))
})

for (const replace of [false, true]) {
  test(`验收 09762 福林探员：取消揭露并保留原诱饵，然后${replace ? '改揭同地另一张' : '抽 1 张牌'}`, () => {
    const state = fixture()
    const inv = state.investigators[0]
    const flint = asset(state, '09762')
    const location = state.locations.find(item => item.id === inv.location)
    location.shroud = 0
    const concealed = scenarioRuntime(state, []).mechanics.tsk.concealed
    const decoy = concealed.place({ kind: 'decoy', decoy: true, locationId: location.id })
    const other = replace ? concealed.place({ kind: 'real', code: '09747a', locationId: location.id }) : null
    move(state, { action: 'fightConcealed', miniId: decoy.id, locationId: location.id })
    settle(state, choice => choice.options.find(option =>
      option.label?.includes('横置福林探员') || option.id === other?.id)?.id)
    assert.ok(concealed.byId(decoy.id))
    assert.equal(concealed.byId(decoy.id).flipped, false)
    assert.equal(state.investigators[0].hand.length, replace ? 0 : 1)
    assert.equal(state.investigators[0].assets.find(item => item.id === flint.id).exhausted, true)
    if (replace) assert.equal(concealed.byId(other.id), null)
  })
}

test('验收 09764 戴维·伊拉万博士：揭示同名手牌，公开记录牌名并把空洞洗回', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const doctor = asset(state, '09764')
  inv.hand = ['01020']
  const api = scenarioRuntime(state, [])
  api.mechanics.tsk.hollow.hollow({ code: '01020', scope: 'investigator', seat: 0 })
  const before = inv.resources
  const command = legalMoves(state).find(item => item.assetId === doctor.id)
  assert.ok(command)
  const events = move(state, command)
  while (state.pendingChoice) {
    const choice = state.pendingChoice
    const id = choice.options.find(option => ['byHand', '01020'].includes(option.id))?.id ?? choice.options[0].id
    events.push(...move(state, { action: 'choose', choiceId: choice.id, optionId: id }))
  }
  assert.equal(state.investigators[0].hand.includes('01020'), true)
  assert.equal(state.investigators[0].deck.includes('01020'), true)
  assert.equal(state.investigators[0].resources, before + 1)
  const reveal = events.find(event => event.text?.includes('揭示手牌中的'))
  assert.ok(reveal?.text.includes(api.cardName('01020')))
  assert.equal(reveal.privateSeat, undefined)
})

test('验收 09768a/09768b 镜刃：用通用 Shift 分别结算稳定面伤害和动荡面直接伤害', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const target = enemy(state)
  const keys = scenarioRuntime(state, []).mechanics.tsk.keys
  keys.initialize([{ id: 'mirroringBlade', stableFace: '09768a', unstableFace: '09768b' }])
  keys.bind('mirroringBlade', { type: 'investigator', seat: 0 })
  move(state, { action: 'shiftKey', keyId: 'mirroringBlade' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2)
  assert.equal(keys.face('mirroringBlade'), '09768b')
  assert.ok(validateMove(state, 0, { action: 'shiftKey', keyId: 'mirroringBlade' }))
  const damage = inv.damage
  state.round += 1
  move(state, { action: 'shiftKey', keyId: 'mirroringBlade' })
  settle(state)
  assert.equal(keys.face('mirroringBlade'), '09768a')
  assert.equal(state.investigators[0].damage, damage + 1)
})
