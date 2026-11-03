import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { registerCardAbilities } from '../src/engine/ability.js'
import { performTest, relocateInvestigator, turnBeginningWindow, scenarioRuntime, damageEnemy, movementError, drawCards } from '../src/engine/engine.js'
import { beginChaosTest, drawChaosToken, endChaosTest } from '../src/engine/chaos-bag.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { mechanicState, normalizeScenarioMechanics, validateMechanicState } from '../src/engine/mechanic-state.js'
import { addPoolTokens, poolTokenCount, payPoolTokens, replacePoolTokens, sealPoolTokens, releasePoolTokens, revealSealedToken, inspectChaosTokens, schedulePoolReplacement, resolvePoolSchedules } from '../src/engine/chaos-token-pool.js'
import { setTokenTreatment } from '../src/engine/chaos-token-effects.js'
import { floodLevel, setFloodLevel, changeFloodLevel, effectiveFloodLevel, beginAirTurn, endAirTurn, checkAirAfterMove } from '../src/engine/flood.js'
import { initializeKeys, keysAt, claimKey, transferKey, spendKey, giveKeys, keysOnExit, placeRandomUnrevealedKey } from '../src/engine/scenario-keys.js'
import { registerVehicle, enterVehicle, leaveVehicle, moveVehicle, setVehicleRunning, vehicleOf } from '../src/engine/vehicles.js'
import { initializeRoad, extendRoad, shortestPaths, orthogonalNeighbors } from '../src/engine/map-graph.js'
import { recordSetAdd, recordSetRemove, recordSetValues, claimRecordReward } from '../src/campaign/record-sets.js'
import { storeBeneath, beneathCards, commitFromOrigin, returnCommitment } from '../src/engine/commit-origins.js'
import { moveUses, spendSharedUses } from '../src/engine/use-transfer.js'
import { makeTurnPromise, notePromiseEvent } from '../src/engine/turn-promises.js'
import { validateTraitLimits, validateDeckRules } from '../web/deck-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { migrateState } from '../src/engine/save-migration.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const copy = value => JSON.parse(JSON.stringify(value))
function transaction(state, execute) {
  resolveTransaction(state, 0, { action: 'primitiveTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 80)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}
function skillTest(state, skill, difficulty) {
  let result
  transaction(state, draft => { result = performTest(draft, 0, skill, difficulty, { resolve: () => {} }) })
  return result
}
const simple = () => ({ round: 1, turnSerial: 1, phase: 'investigation', currentSeat: 0, rngState: 17,
  campaign: { records: {}, chaosBag: [] }, chaosBag: ['0'],
  investigators: [0, 1, 2].map(seat => ({ seat, location: 'a', assets: [], hand: [], deck: [], discard: [] })),
  locations: [{ id: 'a', clues: 1, connections: ['b'] }, { id: 'b', clues: 0, connections: ['a', 'c'] }, { id: 'c', clues: 0, connections: ['b'] }], enemies: [] })

test('有限标记池：揭示区与封印区占用总额；追加费用不足不产生部分写入', () => {
  const s = simple(); addPoolTokens(s, 'bless', 9); sealPoolTokens(s, 'source', 'bless', 3)
  beginChaosTest(s); s.chaosBag = s.chaosBag.filter(t => t !== '0'); drawChaosToken(s)
  assert.equal(poolTokenCount(s, 'bless'), 9)
  const before = copy(s)
  assert.equal(addPoolTokens(s, 'bless', 2, { exact: true }), false); assert.deepEqual(s, before)
  assert.equal(addPoolTokens(s, 'bless', 4), 1); assert.equal(poolTokenCount(s, 'bless'), 10)
  assert.throws(() => addPoolTokens(s, 'unknown', 1)); assert.throws(() => addPoolTokens(s, 'curse', -1))
})
test('有限标记费用：袋内及封印标记可组合支付，非法重复选择／不足均保持原状', () => {
  const s = simple(); addPoolTokens(s, 'bless', 6); sealPoolTokens(s, 'source', 'bless', 4)
  const before = copy(s); assert.equal(payPoolTokens(s, 'bless', 5), false); assert.deepEqual(s, before)
  assert.equal(payPoolTokens(s, 'bless', 2, { selection: [{ zone: 'bag', index: 1 }, { zone: 'bag', index: 1 }] }), false)
  assert.equal(payPoolTokens(s, 'bless', 5, { sealed: true }), 5); assert.equal(poolTokenCount(s, 'bless'), 1)
})
test('替换及释放：不同池上限、指定来源和单枚数量独立处理', () => {
  const s = simple(); addPoolTokens(s, 'bless', 4); addPoolTokens(s, 'curse', 9)
  assert.deepEqual(replacePoolTokens(s, 'bless', 'curse', 3), { removed: 3, added: 1 })
  assert.equal(sealPoolTokens(s, 'one', 'curse', 2), 2); assert.equal(sealPoolTokens(s, 'two', 'curse', 2), 2)
  assert.equal(releasePoolTokens(s, 'one', 'curse', 1, { toPool: true }), 1)
  assert.equal(s.chaos.sealed.filter(t => t.source === 'two').length, 2)
  assert.equal(releasePoolTokens(s, 'one'), 1); assert.equal(poolTokenCount(s, 'curse'), 9)
  assert.throws(() => sealPoolTokens(s, 'x', 'unknown', 1))
})
test('检定外揭示不消耗祝福／诅咒；封印替代揭示进入物理检定生命周期', () => {
  const s = simple(); s.chaosBag = ['bless', 'curse']
  assert.equal(inspectChaosTokens(s, 7).length, 2); assert.equal(s.chaosBag.length, 2)
  sealPoolTokens(s, 'sun', 'bless', 1); beginChaosTest(s)
  assert.equal(revealSealedToken(s, 'sun', 'bless'), 'bless')
  endChaosTest(s, ['bless']); assert.equal(poolTokenCount(s, 'bless'), 0)
  assert.equal(revealSealedToken(s, 'sun', 'bless'), null)
})

registerCardAbilities([
  { code: 'testPoolTreatment', abilities: [{ kind: 'forced', trigger: 'tokenReveal',
    criteria: ({ context }) => context.token === 'bless',
    resolve: ({ api }) => api.chaosTokens.treat({ modifier: 1, stop: true, retain: true }) }] },
  { code: 'testOriginCommit', abilities: [{ kind: 'forced', trigger: 'testBegins',
    resolve: ({ inv, api, source }) => api.commitOrigins.commit(inv.seat, { host: source.id, code: '01091', retain: true }) }] },
  { code: 'testPromise', abilities: [{ kind: 'forced', trigger: 'promiseBroken',
    resolve: ({ api }) => api.chaosTokens.add('curse', 2) }] },
  { code: 'testAfterTokenStep', abilities: [{ kind: 'forced', trigger: 'chaosRevealStepEnded',
    resolve: ({ api, context }) => { for (const token of context.tokens) api.chaosTokens.treat({ index: token.index, modifier: 0, retain: true }) } }] },
  { code: 'testCancelBless', abilities: [{ kind: 'forced', trigger: 'tokenReveal',
    criteria: ({ context }) => context.token === 'bless', resolve: ({ api }) => api.chaosTokens.treat({ cancel: true }) }] },
  { code: 'testReplaceBless', abilities: [{ kind: 'forced', trigger: 'tokenReveal',
    criteria: ({ context }) => context.token === 'bless', resolve: ({ api }) => api.chaosTokens.treat({ as: 'eldersign', retain: true }) }] },
])

test('真实技能检定：祝福／诅咒继续揭示并从池中移除；额外修正与保留从能力 API 接线', () => {
  const s = fixture(); s.chaosBag = ['bless']; asset(s, 'testPoolTreatment')
  const result = skillTest(s, 'willpower', 1)
  settle(s); assert.equal(result.token, 'bless'); assert.deepEqual(result.drawn, ['bless'])
  assert.equal(result.value, s.investigators[0].willpower + 1); assert.deepEqual(s.chaosBag, ['bless'])
  const plain = fixture(); plain.chaosBag = ['bless', 'curse', '0']
  // Fixed seed deterministically exercises chained draws in the exhaustive pure-zone checks below.
  const r = skillTest(plain, 'willpower', 1); settle(plain)
  for (const token of r.drawn.filter(t => ['bless', 'curse'].includes(t))) assert.ok(!plain.chaosBag.includes(token))
})
test('标记修正规格拒绝未知字段；JSON 恢复后逐枚保留与消耗仍守恒', () => {
  const s = simple(); s.chaosBag = ['bless', 'bless']; beginChaosTest(s); drawChaosToken(s); drawChaosToken(s); s.skillTest = {}
  assert.throws(() => setTokenTreatment(s, { fake: true }))
  setTokenTreatment(s, { index: 0, retain: true }); const saved = copy(s)
  endChaosTest(saved, ['bless', 'bless']); assert.deepEqual(saved.chaosBag, ['bless']); assert.equal(saved.chaos.removed.length, 1)
})
test('淹没：等级夹取、禁止增加、非法目标与只读查询不初始化状态', () => {
  const s = simple(); const before = copy(s)
  assert.equal(floodLevel(s, 'a'), 0); assert.deepEqual(s, before)
  assert.equal(setFloodLevel(s, 'a', 2), 2); assert.equal(changeFloodLevel(s, 'a', 5), 2)
  assert.equal(changeFloodLevel(s, 'a', -1), 1); assert.equal(setFloodLevel(s, 'a', 2, { cannotIncrease: true }), false)
  assert.throws(() => setFloodLevel(s, 'missing', 1)); assert.throws(() => setFloodLevel(s, 'a', 3))
})
test('空气：回合初标记、离开完全淹没后永久解除本回合风险、直接伤害及存档恢复', () => {
  const s = simple(); setFloodLevel(s, 'a', 2); assert.equal(beginAirTurn(s, 0), true)
  s.investigators[0].location = 'b'; checkAirAfterMove(s, 0); s.investigators[0].location = 'a'
  assert.equal(endAirTurn(s, 0, () => assert.fail('已呼吸不应受伤')), 0)
  assert.equal(beginAirTurn(s, 0), false, '同回合获得空气后不能重建同一次风险')
  s.turnSerial++
  beginAirTurn(s, 0); const saved = copy(s), hits = []
  assert.equal(endAirTurn(saved, 0, (seat, damage) => hits.push([seat, damage])), 5)
  assert.deepEqual(hits, [[0, 5]]); assert.equal(endAirTurn(saved, 0, () => assert.fail()), 0)
  assert.equal(beginAirTurn(s, 1, { protectedFromAir: true }), false)
})
test('真实回合与位移：场景声明启用空气，移动到安全地点会清理风险', () => {
  const s = fixture(); s.scenario.mechanics = { water: { air: true } }
  scenarioRuntime(s, []).place('hallway'); s.locations.find(loc => loc.id === 'hallway').revealed = true
  const from = s.investigators[0].location, to = 'hallway'
  setFloodLevel(s, from, 2); turnBeginningWindow(s, []); settle(s)
  assert.ok(mechanicState(s).air[0]); relocateInvestigator(s, 0, to, []); settle(s)
  assert.equal(mechanicState(s).air[0], undefined)
})
test('钥匙：隐藏状态、无痕随机放置、清空线索后取得及同地点转移／花费', () => {
  const s = simple(); initializeKeys(s, [{ color: 'red', revealed: false }, { color: 'blue', revealed: false }])
  assert.equal(placeRandomUnrevealedKey(s, 'location:a'), true); assert.deepEqual(keysAt(s, 'location:a'), ['unrevealed'])
  const color = keysAt(s, 'location:a', { reveal: true })[0]
  assert.equal(claimKey(s, 0, color), false); s.locations[0].clues = 0
  assert.equal(claimKey(s, 0, color), true); assert.deepEqual(keysAt(s, 'investigator:0'), [color])
  assert.equal(giveKeys(s, 0, 1, [color]), true); assert.equal(spendKey(s, 1, color), true)
  assert.deepEqual(keysAt(s, 'reference'), [color]); assert.equal(spendKey(s, 1, color), false)
})
test('钥匙：敌人／调查员离场归属、非法目标不产生写入、存档后不复制', () => {
  const s = simple(); s.enemies.push({ id: 'enemy', location: 'a' })
  initializeKeys(s, [{ color: 'green', revealed: false, holder: 'enemy:enemy' }])
  const before = copy(s); assert.throws(() => transferKey(s, 'green', 'enemy:enemy', 'location:missing')); assert.deepEqual(s, before)
  assert.equal(keysOnExit(s, 'enemy:enemy', 'a', 0), 1); s.investigators[0].defeated = true
  assert.equal(keysOnExit(s, 'investigator:0', 'a'), 1)
  const saved = copy(s); assert.equal(claimKey(saved, 0, 'green'), false); assert.deepEqual(keysAt(saved, 'location:a'), ['green'])
})
test('载具：容量、每轮共用一次上下车限制、驾驶替换、洪水保护与原子预检', () => {
  const s = simple(); setFloodLevel(s, 'a', 2)
  registerVehicle(s, 'boat', { location: 'a', capacity: 2, running: true, protectsFromFlood: true })
  assert.equal(enterVehicle(s, 0, 'boat'), true); assert.equal(effectiveFloodLevel(s, 0), 0)
  assert.equal(enterVehicle(s, 1, 'boat'), true); assert.equal(enterVehicle(s, 2, 'boat'), false)
  assert.equal(leaveVehicle(s, 0, 'boat'), false)
  const before = copy(s); assert.equal(moveVehicle(s, 'boat', 'b', { moveInvestigator: () => assert.fail(), entryError: seat => seat === 1 ? 'blocked' : null }), false); assert.deepEqual(s, before)
  const saved = copy(s); assert.equal(moveVehicle(saved, 'boat', 'b', { moveInvestigator: (seat, id) => { saved.investigators[seat].location = id } }), true)
  assert.equal(leaveVehicle(saved, 0, 'boat', { forced: true }), true); assert.equal(mechanicState(saved).vehicles.boat.driver, 1)
})
test('真实载具位移：普通移动被拒绝，载具 API 同步乘客并保留敌人交战', () => {
  const s = fixture('01001', 2), location = s.investigators[0].location
  s.investigators[1].location = location
  scenarioRuntime(s, []).place('hallway'); s.locations.find(loc => loc.id === 'hallway').revealed = true
  const target = 'hallway'
  s.locations.find(loc => loc.id === location).connections.push(target)
  const e = enemy(s, { location, engagedSeat: 0 })
  const api = scenarioRuntime(s, []).mechanics
  api.vehicles.register('car', { location, capacity: 2, running: true }); api.vehicles.enter(0, 'car'); api.vehicles.enter(1, 'car')
  assert.match(movementError(s, s.investigators[0], target), /载具/)
  relocateInvestigator(s, 0, target, []); assert.equal(s.investigators[0].location, location)
  assert.equal(api.vehicles.move('car', target), true); settle(s)
  assert.equal(s.investigators[0].location, target); assert.equal(s.investigators[1].location, target); assert.equal(e.location, target)
})
test('地图：等长最短路线、不可进入地点、断路与正交相邻', () => {
  const graph = [{ id: 'a', connections: ['b', 'c'] }, { id: 'b', connections: ['d'] }, { id: 'c', connections: ['d'] }, { id: 'd', connections: [] }]
  assert.deepEqual(shortestPaths(graph, 'a', 'd'), [['a', 'b', 'd'], ['a', 'c', 'd']])
  assert.deepEqual(shortestPaths(graph, 'a', 'd', id => id !== 'b'), [['a', 'c', 'd']]); assert.deepEqual(shortestPaths(graph, 'd', 'a'), [])
  assert.deepEqual(orthogonalNeighbors([{ x: 1, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0 }), [{ x: 1, y: 0 }])
})
test('Road X：首张取道路牌库、补绕路牌、确定性打乱、整列连接且不重复扩展', () => {
  const s = simple(); initializeRoad(s, { deck: ['road2', 'road1'], detours: ['detour'], columns: { a: 0 } })
  const saved = copy(s)
  const deal = state => extendRoad(state, 'a', 3, id => { state.locations.push({ id, connections: [] }); return id })
  const ids = deal(s); assert.deepEqual(new Set(ids), new Set(['road1', 'detour'])); assert.deepEqual(ids, deal(saved))
  assert.deepEqual(extendRoad(s, 'a', 1, () => assert.fail()), [])
  assert.deepEqual(s.locations.find(loc => loc.id === 'road1').connections, ['a'])
})
test('集合记录：增删、重复恢复与奖励领取均幂等，读不创建字段', () => {
  const campaign = {}; assert.deepEqual(recordSetValues(campaign, 'memoriesRecovered'), []); assert.deepEqual(campaign, {})
  assert.equal(recordSetAdd(campaign, 'memoriesRecovered', 'memoryA'), true); assert.equal(recordSetAdd(campaign, 'memoriesRecovered', 'memoryA'), false)
  assert.equal(claimRecordReward(campaign, 'memoryA:xp'), true); assert.equal(claimRecordReward(copy(campaign), 'memoryA:xp'), false)
  assert.equal(recordSetRemove(campaign, 'memoriesRecovered', 'memoryA'), true); assert.equal(recordSetRemove(campaign, 'memoriesRecovered', 'memoryA'), false)
})
test('特殊来源投入：费用／图标不合法保持原区和顺序；结束后回宿主，不复制牌', () => {
  const s = simple(); s.investigators[0].hand = ['a', 'skill', 'b']; storeBeneath(s, 0, 'host', 'skill'); s.skillTest = { committed: [] }
  const before = copy(s); assert.equal(commitFromOrigin(s, 0, { host: 'host', code: 'skill' }, () => null), false); assert.deepEqual(s, before)
  const item = commitFromOrigin(s, 0, { host: 'host', code: 'skill', retain: true }, (seat, code) => { s.investigators[seat].hand.pop(); const item = { seat, code }; s.skillTest.committed.push(item); return item })
  assert.equal(returnCommitment(s, item), true); assert.deepEqual(beneathCards(s, 0, 'host'), ['skill']); assert.deepEqual(s.investigators[0].hand, ['a', 'b'])
})
test('真实检定：卡下方投入复用现有费用／图标管线，收尾返回原区', () => {
  const s = fixture(); const host = asset(s, 'testOriginCommit'); s.investigators[0].hand.push('01091')
  storeBeneath(s, 0, host.id, '01091')
  const r = skillTest(s, 'combat', 1); settle(s)
  assert.ok(r.committed.includes('01091')); assert.deepEqual(beneathCards(s, 0, host.id), ['01091'])
  assert.equal(s.investigators[0].discard.filter(code => code === '01091').length, 0)
})
test('使用次数：同地点转移与合并支付，不足／错误牌类无部分扣费', () => {
  const s = simple(); s.investigators[0].assets = [{ id: 'a', uses: 1, usesType: 'secrets' }, { id: 'b', uses: 3, usesType: 'secrets' }]
  const before = copy(s); assert.equal(moveUses(s, 'a', 'missing', 'secret', 1), false); assert.deepEqual(s, before)
  assert.equal(moveUses(s, 'b', 'a', 'secret', 2), 2)
  const saved = copy(s); assert.equal(spendSharedUses(saved, 0, 'a', 'secret', 5, ['b']), false); assert.deepEqual(saved, s)
  assert.equal(spendSharedUses(saved, 0, 'a', 'secret', 4, ['b']), 4)
})
test('承诺：只记录自己的回合，一次违背一次通知；来源离场与 JSON 恢复', () => {
  const s = simple(); s.investigators[0].assets.push({ id: 'promise' }); makeTurnPromise(s, 0, 'promise', 'draw')
  s.currentSeat = 1; assert.deepEqual(notePromiseEvent(s, 0, 'draw'), [])
  s.currentSeat = 0; const saved = copy(s); assert.deepEqual(notePromiseEvent(saved, 0, 'draw'), ['promise']); assert.deepEqual(notePromiseEvent(saved, 0, 'draw'), [])
  s.investigators[0].assets = []; assert.deepEqual(notePromiseEvent(s, 0, 'draw'), [])
})
test('真实抽牌：违背承诺触发已登记窗口和卡牌 API', () => {
  const s = fixture(); const source = asset(s, 'testPromise'); makeTurnPromise(s, 0, source.id, 'draw')
  drawCards(s, s.investigators[0], 1, []); settle(s)
  assert.equal(s.chaosBag.filter(token => token === 'curse').length, 2)
  drawCards(s, s.investigators[0], 1, []); settle(s); assert.equal(s.chaosBag.filter(token => token === 'curse').length, 2)
})
test('契约：不同名称／等级共享一张上限；初始与升级构筑共用读点', () => {
  const codes = ['07110', '07113']; assert.equal(validateTraitLimits(codes, ALL_CARDS).length, 1)
  assert.deepEqual(validateTraitLimits(codes.slice(0, 1), ALL_CARDS), [])
  assert.ok(validateDeckRules(ALL_CARDS['07001'], codes, ALL_CARDS, { partial: true }).errors.some(error => error.includes('Covenant')))
})
test('声明与存档：未知参数在注册阶段失败，新字段 JSON 往返并经存档入口校验', () => {
  assert.throws(() => normalizeScenarioMechanics({ unknown: true })); assert.throws(() => normalizeScenarioMechanics({ water: { damage: -1 } }))
  const old = fixture(), oldCopy = copy(old); validateMechanicState(old); assert.deepEqual(old, oldCopy)
  const s = fixture(); setFloodLevel(s, s.investigators[0].location, 2); beginAirTurn(s, 0)
  assert.deepEqual(migrateState(copy(s)).state.scenarioFlags.mechanics, s.scenarioFlags.mechanics)
  const broken = copy(s); broken.scenarioFlags.mechanics.version = 999
  assert.throws(() => migrateState(broken), /版本/)
})
test('真实标记窗口：揭示步骤结束后修改先前标记修正与去向，而非只修改最后一枚', () => {
  const s = fixture(); asset(s, 'testAfterTokenStep'); s.chaosBag = ['bless', '0']; s.rngState = 0
  const r = skillTest(s, 'willpower', 1)
  assert.deepEqual(r.drawn, ['bless', '0']); assert.equal(r.value, s.investigators[0].willpower)
  assert.ok(s.chaosBag.includes('bless'))
})
test('真实标记窗口：取消后再揭示／视为旧印，物理祝福按各自指示消耗或保留', () => {
  const cancelled = fixture(); asset(cancelled, 'testCancelBless'); cancelled.chaosBag = ['bless', '0']; cancelled.rngState = 0
  const r = skillTest(cancelled, 'willpower', 1)
  assert.deepEqual(r.drawn, ['0']); assert.ok(r.cancelledTokens.includes('bless')); assert.equal(poolTokenCount(cancelled, 'bless'), 0)
  const replaced = fixture(); asset(replaced, 'testReplaceBless'); replaced.chaosBag = ['bless']
  const result = skillTest(replaced, 'willpower', 1)
  assert.equal(result.elderSign, true); assert.equal(poolTokenCount(replaced, 'bless'), 1)
})
test('延后标记替换：JSON 往返、轮末幂等与轮中新增标记均纳入结算', () => {
  const s = simple(); addPoolTokens(s, 'bless', 2); schedulePoolReplacement(s, 'bless', 'curse')
  const saved = copy(s); addPoolTokens(saved, 'bless', 1)
  assert.deepEqual(resolvePoolSchedules(saved), [{ removed: 3, added: 3 }])
  assert.deepEqual(resolvePoolSchedules(saved), []); assert.equal(poolTokenCount(saved, 'curse'), 3)
})
test('载具动态移动被阻止：规则事务回滚全部乘客与载具，避免分散到不同地点', () => {
  const s = fixture('01001', 2); const from = s.investigators[0].location; s.investigators[1].location = from
  scenarioRuntime(s, []).place('hallway'); s.locations.find(loc => loc.id === from).connections.push('hallway')
  registerVehicle(s, 'car', { location: from, capacity: 2, running: true }); enterVehicle(s, 0, 'car'); enterVehicle(s, 1, 'car')
  const before = copy(s)
  assert.throws(() => transaction(s, draft => moveVehicle(draft, 'car', 'hallway', {
    moveInvestigator: (seat, destination) => { if (seat === 0) draft.investigators[seat].location = destination },
  })), /回滚/)
  assert.deepEqual(s, before)
})
