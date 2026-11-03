import test from 'node:test'
import assert from 'node:assert/strict'
import { interactionFixture, HOST, BOAT } from './tic-interaction-fixture.mjs'
import { move, answer, settle } from './core-fixture.mjs'
import { legalMoves, validateMove, scriptActionHints, getStat, getMaxSanity } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { mechanicView, mechanicSnapshot, maskMechanicSnapshot } from '../src/integration/mechanic-view.js'
import { viewState, viewEvents } from '../src/integration/observation.js'
import { captureTableState, projectTableState } from '../src/integration/presentation-state.js'
import { selectMechanic } from '../src/engine/mechanic-choices.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { scriptCardOwner } from '../src/engine/script-cards.js'

const json = value => JSON.parse(JSON.stringify(value))
const use = (s, index) => {
  while (s.pendingChoice?.kind === 'playerWindow') answer(s, 'skip')
  s.legalMoves = legalMoves(s, 0)
  const command = s.legalMoves.find(m => m.action === 'ability' && m.assetId === HOST && m.abilityIndex === index)
  assert.ok(command, `能力 ${index} 必须是服务端合法动作`)
  move(s, command)
}
const choose = (s, id) => answer(s, id)
const confirmOne = (s, index = 0) => { choose(s, `pick:${index}`); choose(s, 'confirm') }

test('P4 封印实体多选：确认前无扣除、取消及取消重试、重复点击可撤选', () => {
  const s = interactionFixture(), before = [...s.chaosBag]
  use(s, 0); choose(s, 'pick:0'); assert.deepEqual(s.chaosBag, before)
  assert.equal(s.pendingChoice.options.some(o => o.id === 'confirm'), false)
  choose(s, 'pick:0'); choose(s, 'cancel'); assert.deepEqual(s.chaosBag, before)
  use(s, 0); choose(s, 'pick:0'); choose(s, 'pick:1'); choose(s, 'confirm')
  assert.deepEqual(s.chaosBag, ['0']); assert.deepEqual(s.chaos.sealed.map(x => x.token), ['bless', 'curse'])
  use(s, 1); confirmOne(s); assert.equal(s.chaos.sealed.length, 1); assert.equal(s.chaosBag.length, 2)
})

test('P4 选择凭据：其他座位、伪造索引、过期 choiceId 被拒绝；JSON 暂停恢复结果相同', () => {
  const s = interactionFixture(); use(s, 0)
  const first = s.pendingChoice.id
  assert.ok(validateMove(s, 1, { action: 'choose', choiceId: first, optionId: 'pick:0' }))
  assert.ok(validateMove(s, 0, { action: 'choose', choiceId: first, optionId: 'pick:900' }))
  choose(s, 'pick:0'); const saved = json(s)
  assert.ok(validateMove(s, 0, { action: 'choose', choiceId: first, optionId: 'pick:1' }))
  for (const state of [s, saved]) { choose(state, 'pick:1'); choose(state, 'confirm') }
  assert.deepEqual(saved.scenarioFlags, s.scenarioFlags); assert.deepEqual(saved.chaos, s.chaos)
})

test('P4 隐藏钥匙使用不含颜色的选项；取得后公开；转交取消不支付，成功同地点转交及花费', () => {
  const s = interactionFixture(); use(s, 2)
  assert.equal(JSON.stringify(s.pendingChoice).includes('blue'), false)
  confirmOne(s); assert.equal(s.scenarioFlags.mechanics.keys.blue.holder, 'investigator:0')
  assert.equal(s.scenarioFlags.mechanics.keys.blue.revealed, true)
  use(s, 3); confirmOne(s); choose(s, 'cancel')
  assert.equal(s.scenarioFlags.mechanics.keys.red.holder, 'investigator:0')
  use(s, 3); confirmOne(s); confirmOne(s)
  assert.equal(s.scenarioFlags.mechanics.keys.red.holder, 'investigator:1')
  use(s, 4); confirmOne(s); assert.equal(s.scenarioFlags.mechanics.keys.blue.holder, 'reference')
})

test('P4 载具：上下车限制、乘客和驾驶者、权威位移、空气风险及多人交接', () => {
  const s = interactionFixture(); use(s, 5); confirmOne(s)
  assert.equal(s.scenarioFlags.mechanics.vehicles[BOAT].driver, 0)
  assert.equal(s.scenarioFlags.mechanics.air[0], undefined)
  const before = s.investigators[0].location; use(s, 6); confirmOne(s); confirmOne(s)
  assert.notEqual(s.investigators[0].location, before)
  assert.equal(s.scenarioFlags.mechanics.vehicles[BOAT].location, s.investigators[0].location)
  use(s, 7); assert.notEqual(s.pendingChoice?.kind, 'mechanic') // No candidates does not block the game.
  const model = mechanicView(s, 0).vehicles[0]; assert.match(model.leaveReason, /本轮/)
  const x = interactionFixture(), boat = x.scenarioFlags.mechanics.vehicles[BOAT]
  x.investigators.push({ ...json(x.investigators[1]), seat: 2, name: '第三位' })
  boat.passengers = [0, 1, 2]; boat.driver = 0
  use(x, 7); confirmOne(x); confirmOne(x, 1)
  assert.equal(x.scenarioFlags.mechanics.vehicles[BOAT].driver, 2)
  assert.deepEqual(x.scenarioFlags.mechanics.vehicles[BOAT].passengers, [1, 2])
})

test('P4 特殊投入／收回真实检定：非法图标不进入候选、收回不重复弃置或结算成功奖励', () => {
  const s = interactionFixture(), deck = s.investigators[0].deck.length
  s.chaosBag = ['0']
  use(s, 8)
  assert.equal(s.pendingChoice.source.operation, 'commitOrigin')
  assert.equal(s.pendingChoice.options.some(o => o.cardCode === '01091'), false)
  confirmOne(s)
  settle(s, choice => {
    if (choice.kind !== 'mechanic') return null
    if (choice.source.operation === 'returnCommitment') return choice.options.some(o => o.selected) ? 'confirm' : 'pick:0'
    return 'cancel'
  })
  assert.ok(s.investigators[0].hand.includes('01089'))
  assert.equal(s.investigators[0].discard.includes('01089'), false)
  assert.equal(s.investigators[0].deck.length, deck)
  assert.equal(s.lastTestResult.value, s.investigators[0].willpower)
})

test('P4 隐私投影：宿主下方仅本人，未揭示钥匙不泄色；隐藏解答、未来路牌及未触发记忆不投影', () => {
  const s = interactionFixture(), data = s.scenarioFlags.mechanics
  s.scenarioFlags.answer = { suspect: 'secret-suspect', hideout: 'secret-hideout', futureMemory: 'secret-memory' }
  data.road = { roadDeck: ['secret-road'], detourDeck: ['secret-detour'] }
  const owner = viewState(s, 0), other = viewState(s, 1), spectator = viewState(s, null)
  assert.ok(owner.mechanics.beneath[0].codes.includes('01089'))
  for (const view of [other, spectator]) {
    assert.equal('codes' in view.mechanics.beneath[0], false)
    assert.equal(view.mechanics.keys.some(k => k.color === 'blue' || k.color === 'green'), false)
    for (const secret of ['secret-suspect', 'secret-hideout', 'secret-memory', 'secret-road', 'secret-detour']) assert.equal(JSON.stringify(view).includes(secret), false)
  }
  const snapshot = mechanicSnapshot(s)
  assert.ok(snapshot.beneath[0].codes)
  assert.equal('codes' in maskMechanicSnapshot(snapshot, 1).beneath[0], false)
  const event = viewEvents([{ tableState: captureTableState(s, getStat, getMaxSanity) }], 1)[0]
  assert.equal('codes' in event.tableState.mechanics.beneath[0], false)
  assert.deepEqual(projectTableState(event.tableState, 1), event.tableState)
  assert.equal(data.beneath[0][HOST].length, 3)
})

test('P4 跳过揭示步骤不产生收回选择；牌按检定结束的既定去向返回', () => {
  const s = interactionFixture()
  s.investigators[0].nextTestNoTokens = { round: s.round }
  use(s, 8); confirmOne(s)
  let retrievals = 0
  settle(s, choice => {
    if (choice.kind === 'mechanic' && choice.source.operation === 'returnCommitment') { retrievals++; return 'cancel' }
    return null
  })
  assert.equal(retrievals, 0)
  assert.ok(s.scenarioFlags.mechanics.beneath[0][HOST].includes('01089'))
})

test('P4 私人连续揭示按物理下标展示，其他座位与动画不收到标记；公开求助后共享', () => {
  const s = interactionFixture()
  s.skillTest = { seat: 0, committed: [], tokenResults: [{ index: 0, face: 'bless', modifier: 2 }, { index: 1, face: 'curse', modifier: -2 }] }
  s.chaos = { revealed: ['bless', 'curse'], sealed: [], removed: [] }
  assert.equal(viewState(s, 0).mechanics.tokens.length, 2)
  assert.equal(viewState(s, 1).mechanics.tokens, undefined)
  assert.deepEqual(viewState(s, 1).chaos.revealed, [])
  assert.equal(maskMechanicSnapshot(mechanicSnapshot(s), 1).tokens, undefined)
  s.skillTest.helpRequested = true
  assert.equal(viewState(s, 1).mechanics.tokens.length, 2)
})

test('P4 空候选不暂停；强制选择没有取消入口，合法选项全部来自同一选择表', () => {
  const s = interactionFixture()
  assert.equal(selectMechanic(s, 0, { operation: 'seal', prompt: '空', candidates: [] }), null)
  resolveTransaction(s, 0, { action: 'fixture' }, draft => selectMechanic(draft, 0, {
    operation: 'seal', prompt: '必须选择', optional: false, candidates: [{ label: '0', value: '0' }],
  }))
  assert.equal(s.pendingChoice.options.some(o => o.id === 'cancel'), false)
})

test('P4 私人揭示不通过袋内差集泄露；嵌套检定只投影当前帧的实体', () => {
  const s = interactionFixture()
  s.skillTest = { seat: 0, committed: [], tokenResults: [] }
  s.chaosBag = ['curse', '0']; s.chaos = { frames: [0], revealed: ['bless'], sealed: [], removed: [] }
  const first = viewState(s, 1)
  s.chaosBag = ['bless', '0']; s.chaos.revealed = ['curse']
  const second = viewState(s, 1)
  assert.deepEqual(first.chaosBag, second.chaosBag)
  assert.deepEqual(first.chaos, second.chaos)
  s.skillTest.seat = 1; s.chaos.frames = [0, 1]; s.chaos.revealed = ['bless', '0']; s.chaosBag = ['curse']
  const nested = viewState(s, 1)
  assert.deepEqual(nested.mechanics.tokens.map(item => item.face), ['0'])
  assert.deepEqual(nested.chaos.revealed, ['0'])
  assert.deepEqual(nested.chaosBag, ['bless', 'curse'])
})

test('P4 scriptCard 仅声明归属，非法地点／敌人不误挂幕卡；公开提示与合法动作使用同一读点', () => {
  const s = interactionFixture(); s.scenario.scriptCards = { rules: { takeKey: 'act', useBoat: 'agenda' } }
  assert.equal(scriptCardOwner(s, { action: 'scenarioAction', rule: 'takeKey' }), 'act')
  assert.equal(scriptCardOwner(s, { action: 'scenarioAction', rule: 'useBoat' }), 'agenda')
  assert.equal(scriptCardOwner(s, { action: 'move', locationId: s.locations[1].id }), null)
  assert.equal(scriptCardOwner(s, { action: 'fight', enemyId: 'e1' }), null)
  const hints = scriptActionHints(s, 0)
  assert.deepEqual(viewState(s, 0).scriptActions, hints.filter(hint => ['act', 'agenda'].includes(hint.scriptCard)))
})
