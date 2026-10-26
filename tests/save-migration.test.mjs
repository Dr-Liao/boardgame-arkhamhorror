import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove, legalMoves, decisionSeat } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'
import { STATE_SCHEMA_VERSION, RULES_VERSION, stateCompatibilityError } from '../src/engine/rules-state.js'
import { META } from '../src/cards/cards-data.js'

const players = count => Array.from({ length: count }, (_, seat) => ({ seat, role: seat ? 'ai' : 'human' }))
const restore = state => JSON.parse(JSON.stringify(state))
const create = (campaignHub = false) => createGameState({ playerInvestigator: '01001', seed: 'save-migration', campaignHub }, players(2))

function assertPlayable(state) {
  assert.equal(stateCompatibilityError(state, META.resourceVersion), null)
  const seat = decisionSeat(state)
  const moves = legalMoves(state)
  assert.ok(moves.length)
  for (const move of moves) assert.equal(validateMove(state, seat, move), null, JSON.stringify(move))
  const branch = restore(state)
  applyMove(branch, seat, moves[0])
  assert.equal(branch.revision, state.revision + 1)
}

test('当前版本存档无需迁移，返回原对象且不复制', () => {
  const state = create()
  const result = migrateState(state)
  assert.equal(result.state, state)
  assert.deepEqual(result.changes, [])
  const forced = migrateState(restore(state), { force: true })
  assert.deepEqual(forced.changes, [], '健康存档强制修复检查不产生改动')
})

test('旧卡面缺少自动反应字段时刷新内嵌卡牌定义', () => {
  const old = restore(create())
  for (const [code, def] of Object.entries(old.cards)) {
    if (!def || typeof def !== 'object') continue
    old.cards[code] = { ...def }
    delete old.cards[code].hasAutoReaction
    delete old.cards[code].autoByDefault
  }
  const { state, changes } = migrateState(old)
  assert.ok(changes.includes('刷新内嵌卡牌定义'), JSON.stringify(changes))
  assert.equal(state.cards['01001'].hasAutoReaction, true)
  assert.equal(state.cards['01001'].autoByDefault, true, '罗兰无目标纯收益，默认 auto')
  const reactionCards = Object.values(state.cards).filter(def => def && typeof def === 'object'
    && (def.type === 'investigator' || def.hasReactionPrompt
      || (Array.isArray(def.reactionIds) && def.reactionIds.length)))
  assert.ok(reactionCards.length > 0)
  assert.ok(reactionCards.every(def => Object.hasOwn(def, 'autoByDefault')), '刷新后有反应的卡面都带新字段')
})

test('结构 v6 / 规则 n5.1 存档可逐级升级到当前规则并继续行动', () => {
  const old = restore(create())
  // 旧存档是结构 v6 + 旧规则版本；只改 rulesVersion 会造出"当前结构 + 旧规则"这种不存在的版本对。
  old.schemaVersion = 6
  old.rulesVersion = 'n5.1'
  old.resourceVersion = 'n5.1-resources'
  const snapshot = JSON.stringify(old)
  const { state, changes } = migrateState(old)
  assert.equal(JSON.stringify(old), snapshot, '迁移不得修改入参')
  assert.equal(state.schemaVersion, STATE_SCHEMA_VERSION)
  assert.equal(state.rulesVersion, RULES_VERSION)
  assert.equal(state.resourceVersion, META.resourceVersion)
  assert.ok(changes.some(item => item.includes('规则更新（存档结构不变）')), changes.join())
  assert.ok(changes.some(item => item.includes('持续效果实体')), changes.join())
  assert.ok(changes.includes('卡牌资源升级到当前版本'), changes.join())
  assertPlayable(state)
})

test('n5.2 双人存档会修正“往事回声”全部按人数计算的密谋阈值', () => {
  const old = restore(create())
  old.schemaVersion = 6
  old.rulesVersion = 'n5.2'
  const agendas = [
    { originalCode: '03121', doomThreshold: 2 },
    { originalCode: '03122', doomThreshold: 2 },
    { originalCode: '03123', doomThreshold: 3 },
  ]
  old.agendas = restore(agendas)
  old.scenario.agendas = restore(agendas)
  const { state, changes } = migrateState(old)
  assert.deepEqual(state.agendas.map(agenda => agenda.doomThreshold), [4, 4, 6])
  assert.deepEqual(state.agendas.map(agenda => agenda.doomThresholdPerInvestigator), [2, 2, 3])
  assert.deepEqual(state.scenario.agendas.map(agenda => agenda.doomThreshold), [4, 4, 6])
  assert.ok(changes.some(item => item.includes('往事回声')), changes.join())
})

test('n5.3 存档会分离“胆量”的显示身份与底牌记录', () => {
  const old = restore(create())
  old.schemaVersion = 6
  old.rulesVersion = 'n5.3'
  old.investigators[0].assets.push({
    id: 'courage-0-1',
    code: 'xcourage',
    originalCode: '01024',
    name: '胆量',
    sanity: 2,
    courage: true,
  })
  const { state, changes } = migrateState(old)
  const courage = state.investigators[0].assets.find(asset => asset.code === 'xcourage')
  assert.equal(courage.underlyingCode, '01024')
  assert.ok(!Object.hasOwn(courage, 'originalCode'))
  assert.ok(changes.some(item => item.includes('胆量')), changes.join())
})

test('n5.4 存档会把旧支援区中的“约束衣”迁入威胁区并恢复弃置能力', () => {
  const old = restore(create())
  old.schemaVersion = 6
  old.rulesVersion = 'n5.4'
  old.investigators[0].assets.push({ id: 'legacy-straitjacket', code: '03185' })
  const { state, changes } = migrateState(old)
  const inv = state.investigators[0]
  assert.ok(!inv.assets.some(asset => asset.code === '03185'))
  const jacket = inv.threat.find(card => card.code === '03185')
  assert.equal(jacket.id, 'legacy-straitjacket')
  assert.deepEqual(jacket.slots, ['Body', 'Hand x2'])
  assert.equal(jacket.cannotLeavePlay, true)
  assert.deepEqual(jacket.threatEffect, {
    discardCost: { action: 2 },
    sameLocationAction: true,
  })
  assert.ok(changes.some(item => item.includes('约束衣')), changes.join())
})

test('升级选项很多的局间存档只按行动类型抽样校验', { timeout: 5000 }, () => {
  const old = restore(createGameState({
    playerInvestigator: '01001',
    campaignId: 'thePathToCarcosa',
    seed: 'save-migration-upgrades',
  }, players(2)))
  Object.assign(old, {
    hubFlow: true,
    uiState: 'interlude',
    phase: 'interlude',
    currentSeat: 0,
    humanSeats: [],
    pendingChoice: null,
    continuation: null,
    hubReady: false,
    hubUpgradedSeats: {},
    hubSeatDone: {},
    schemaVersion: 6,
    rulesVersion: 'n5.2',
  })
  Object.assign(old.campaign, {
    phase: 'interlude',
    flowStage: 'interlude',
    upgradesAllowed: true,
    scenarioIndex: 1,
    scenarioResults: [{ scenarioId: 'curtainCall' }],
  })
  Object.assign(old.campaign.investigators[0], {
    xp: 10,
    currentScenarioIndex: 0,
    startingDeckReady: true,
  })
  old.legalMoves = legalMoves(old)
  assert.ok(old.legalMoves.filter(move => move.action === 'hubPurchase').length > 1000)
  const { state } = migrateState(old)
  assert.equal(state.rulesVersion, RULES_VERSION)
  assert.ok(state.legalMoves.some(move => move.action === 'hubPurchase'))
})

test('卡牌资源版本变化的旧存档：核对卡号后升级，不改动牌序、随机状态与进度', () => {
  for (const hub of [false, true]) {
    const current = create(hub)
    const old = restore(current)
    old.resourceVersion = 'f'.repeat(64)
    old.cards = { stale: { name: '旧定义' } }
    old.legalMoves = []
    const snapshot = JSON.stringify(old)
    const { state, changes } = migrateState(old)
    assert.equal(JSON.stringify(old), snapshot, '迁移不得修改入参')
    assert.ok(changes.includes('卡牌资源升级到当前版本'), changes.join())
    assert.equal(state.resourceVersion, META.resourceVersion)
    const saved = restore(current), migrated = restore(state)
    assert.deepEqual(migrated.cards, saved.cards)
    for (const key of ['rngState', 'seed', 'revision', 'instanceSeq', 'investigators', 'campaign', 'pendingChoice', 'uiState'])
      assert.deepEqual(migrated[key], saved[key], key)
    assertPlayable(state)
  }
})

test('待决选择中的旧资源存档迁移后可继续回答', () => {
  const old = restore(create())
  assert.ok(old.pendingChoice, '开局换牌为待决选择')
  old.resourceVersion = 'old-resources'
  const { state } = migrateState(old)
  assert.equal(state.pendingChoice.id, old.pendingChoice.id)
  assertPlayable(state)
})

test('存档引用当前资源中不存在的卡牌时拒绝升级并指出卡号', () => {
  const old = restore(create())
  old.resourceVersion = 'old-resources'
  old.investigators[0].deck.push('99999')
  assert.throws(() => migrateState(old), /99999/)
})

test('无迁移路径或来自更新版本的存档明确拒绝', () => {
  for (const [patch, pattern] of [
    [{ schemaVersion: 4 }, /暂无迁移路径/],
    [{ rulesVersion: 'n4.0' }, /暂无迁移路径/],
    [{ schemaVersion: STATE_SCHEMA_VERSION + 1 }, /更新版本/],
    [{ schemaVersion: undefined }, /结构版本/],
  ]) {
    const old = Object.assign(restore(create()), patch)
    assert.throws(() => migrateState(old), pattern, JSON.stringify(patch))
  }
})

test('登记的迁移步骤逐级执行，并在说明中记录版本变化', () => {
  const old = restore(create())
  old.schemaVersion = STATE_SCHEMA_VERSION - 2
  old.rulesVersion = 'legacy'
  delete old.sealedTokens
  const calls = []
  const migrations = [
    { from: [STATE_SCHEMA_VERSION - 1, 'legacy'], to: [STATE_SCHEMA_VERSION, RULES_VERSION], note: '第二步', up: s => calls.push(['b', s.schemaVersion]) },
    { from: [STATE_SCHEMA_VERSION - 2, 'legacy'], to: [STATE_SCHEMA_VERSION - 1, 'legacy'], note: '第一步', up: s => calls.push(['a', s.schemaVersion]) },
  ]
  const { state, changes } = migrateState(old, { migrations })
  assert.deepEqual(calls, [['a', STATE_SCHEMA_VERSION - 2], ['b', STATE_SCHEMA_VERSION - 1]])
  assert.equal(state.schemaVersion, STATE_SCHEMA_VERSION)
  assert.equal(state.rulesVersion, RULES_VERSION)
  assert.match(changes[0], /第一步/)
  assert.match(changes[1], /第二步/)
  assert.deepEqual(state.sealedTokens, [], '缺失的空字段按新开局模板补齐')
  assert.ok(changes.some(item => item.includes('sealedTokens')))
  assertPlayable(state)
  const failing = [{ from: [STATE_SCHEMA_VERSION - 2, 'legacy'], to: [STATE_SCHEMA_VERSION, RULES_VERSION], up() { throw new Error('无法换算旧字段') } }]
  assert.throws(() => migrateState(Object.assign(restore(create()), { schemaVersion: STATE_SCHEMA_VERSION - 2, rulesVersion: 'legacy' }), { migrations: failing }), /无法换算旧字段/)
})

test('强制修复补齐缺失字段并重算合法行动', () => {
  const broken = restore(create(true))
  delete broken.exiledBySeat
  broken.legalMoves = []
  const { state, changes } = migrateState(broken, { force: true })
  assert.deepEqual(state.exiledBySeat, [])
  assert.ok(changes.includes('重算合法行动'))
  assert.deepEqual(state.legalMoves, legalMoves(state))
  assertPlayable(state)
})
