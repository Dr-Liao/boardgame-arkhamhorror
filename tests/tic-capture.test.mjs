// w7 专属验收测试：TIC 捕获 / 押送机制（引擎） + 5 张卡
//   07233 议程·不变如海 / 07252 剧情·惨遭俘获！ / 07252b 地点·拘禁室
//   07253 敌人·奥赛罗思·马什 / 07260 诡计·惨遭俘虏
//
// 覆盖：
//   1 注册与声明（scope / implemented / flags.captureLocation / locationRule 限制）
//   2 捕获唯一写入口（mechanicState.captured、手槽支援返手、解除交战、钥匙转移、
//     拘禁室翻面入场 (5,1) 孤立、不同 inv 私有字段）
//   3 被俘的全局限制（移动/攻击/交战；伪造 validateMove 同样被拒；其他调查员不受影响）
//   4 07252 首次被俘读剧情文本，后续只结算同样的物理效果
//   5 07252b：[action] 战斗/敏捷(3) 解救、黄钥匙自动成功、不能被淹没、敌人不能进入/生成
//   6 07260 显现：敏捷(4)失败被俘+钥匙放拘禁室；成功不受影响
//   7 07253：淹没时 +2 躲避；成功躲避按差值夺钥匙；敌军阶段攻击后被俘+钥匙放马什；
//     非敌军阶段不俘获
//   8 07233：被俘时推进议程+毁灭转移到下个密谋；背面全员被俘/马什放一边/地图扩张/
//     直接推进场景 3a；batch 不递归
//   9 存档 JSON 往返、非法存档被拒、观察投影可见且公开
//
// 运行：node --test tests/tic-capture.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, move, settle, validateMove, asset } from './core-fixture.mjs'
import {
  capturedAtLocation, capturedLocation, capturedSeats, enemyEvadeValue, engageEnemy,
  isCaptured, movementError, reactionWindow, revealLocation, scenarioRuntime, spawnEnemy,
} from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'
import { enemyCanEnterLocation } from '../src/engine/enemy-entry.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'

import entry07233 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07233.js'
import entry07252 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07252.js'
import entry07252b from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07252b.js'
import entry07253 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07253.js'
import entry07260 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07260.js'

// 索引由 Lead 统一重建；测试进程内对「索引未含的条目」直接注册兜底（重复注册会 throw）。
const ENTRIES = [entry07233, entry07252, entry07252b, entry07253, entry07260]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const EXPECTED_SCOPES = {
  '07233': 'agenda', '07252': 'storyAsset', '07252b': 'location', '07253': 'enemy', '07260': 'treachery',
}

// 事务包装（与 tests/tic-alight-cards.test.mjs 同款）：ScenarioEnded 视为正常收场。
function transaction(s, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(s, 0, { action: 'ticCapture' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 100, `choice loop ${s.pendingChoice.source}`)
    const choice = s.pendingChoice
    const id = select(choice, s)
      ?? ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}

const codeOf = entity => String(entity?.originalCode || entity?.code)
const locationOf = (s, code) => s.locations.find(location => codeOf(location) === code) || null
const enemyOf = (s, code) => s.enemies.find(enemy => codeOf(enemy) === code) || null
const actionOn = (s, entityId, seat = 0) => legalMoves(s, seat).find(command =>
  command.action === 'entityAbility' && command.entityId === entityId)

function captureSeat(seat, options = {}) {
  return s => transaction(s, draft => scenarioRuntime(draft, []).capture(seat, options))
}

function placeAt(s, id, x, y) {
  return transaction(s, draft => scenarioRuntime(draft, []).mechanics.map.place(id, x, y))
}

// 标准「捕获一人」的夹具：2 人局，1 号被俘。
function capturedFixture() {
  const s = chapterFixture('aLightInTheFog', 2)
  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07252', keysTo: 'destination' }))
  return s
}

test('5 张卡注册：scope / implemented / 声明式字段逐条对印刷', () => {
  for (const [code, scope] of Object.entries(EXPECTED_SCOPES)) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册`)
    assert.equal(entry.code, code)
    assert.equal(entry.scope, scope, `${code} scope`)
    assert.equal(entry.implemented, true, `${code} implemented`)
  }
  // 07252：翻面成拘禁室（chapter-data.setup.expandedMap.holdingCells：column 5 / row 1 / 排除行列）
  assert.deepEqual(registeredEntry('07252').flags.captureLocation,
    { code: '07252b', column: 5, row: 1, isolated: true }, '07252 flags.captureLocation')
  // 07252b：不能淹没 + 敌人不能进入/生成（改到任意沉没岩洞）
  const rule = registeredEntry('07252b').locationRule
  assert.deepEqual(rule.floodBounds, { min: 0, max: 0 })
  assert.equal(rule.enemiesCannotEnter, true)
  assert.deepEqual(rule.enemySpawnRedirect.toOriginalCodes.slice().sort(), ['07244', '07245', '07246'])
  assert.equal(rule.enemySpawnRedirect.chooser, 'lead')
  // 07233：毁灭带到下个密谋 + 被俘推进/背面结算钩子
  assert.equal(registeredEntry('07233').agendaRule.doomToNextAgenda, true)
  assert.equal(typeof registeredEntry('07233').agendaRule.onCaptured, 'function')
  assert.equal(typeof registeredEntry('07233').agendaRule.onReveal, 'function')
  // 07253：+2 躲避修正行；07260：显现检定由条目接管
  assert.equal(registeredEntry('07253').modifiers[0].target, 'enemyEvade')
  assert.equal(typeof registeredEntry('07260').encounterResolve, 'function')
})

test('捕获唯一写入口：状态/返手/解除交战/钥匙/拘禁室翻面入场，不写 inv 私有字段', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const mechanics = createMechanicsApi(s)
  asset(s, '01020', {}, 1) // 手槽
  asset(s, '01030', {}, 1) // 手槽
  asset(s, '01059', {}, 1) // 饰品槽
  mechanics.keys.transfer('red', 'setAside', 'investigator:1', { reveal: true })
  const home = s.investigators[1].location
  const enemy = { id: 'enemy-capture-test', code: 'ghoulMinion', name: '测试敌人', location: home,
    fight: 1, evade: 1, health: 5, damageTaken: 0, damage: 0, horror: 0,
    engagedSeat: 1, exhausted: false, traits: [] }
  s.enemies.push(enemy)
  s.investigators[1].engaged.push(enemy.id)
  assert.equal(s.investigators[1].engaged.length, 1, '捕获前与敌人交战')
  assert.equal(s.scenarioFlags.mechanics?.captured, undefined, '捕获前没有 captured 键')
  assert.equal(Object.hasOwn(s.investigators[1], 'captured'), false, '不写 inv 私有字段')

  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07260', keysTo: 'destination' }))

  const inv = s.investigators[1]
  const cells = locationOf(s, '07252b')
  assert.ok(cells, '拘禁室已翻面入场')
  assert.deepEqual(capturedSeats(s), [1], '被俘座位唯一权威来源')
  assert.equal(capturedLocation(s, 1), cells.id)
  const position = createMechanicsApi(s).map.position(cells.id)
  assert.deepEqual(position, { x: 5, y: 1, isolated: true }, '拘禁室不在任何行/列（孤立格）')
  assert.equal(inv.location, cells.id, '被俘者被放到拘禁室（内部放行）')
  assert.equal(inv.engaged.length, 0, '解除交战')
  assert.ok(inv.hand.includes('01020') && inv.hand.includes('01030'), '手槽支援返回手牌')
  assert.equal(inv.assets.some(item => ['01020', '01030'].includes(item.code)), false, '手槽支援已离场')
  assert.ok(inv.assets.some(item => item.code === '01059'), '非手槽支援留在场')
  assert.deepEqual(keysAt(s, `location:${cells.id}`, { reveal: true }), ['red'], '钥匙放到拘禁室')
  assert.equal(s.storyAssets.some(item => codeOf(item) === '07252'), false, '剧情面离场（翻到背面）')
  const stored = s.scenarioFlags.mechanics.captured
  assert.equal(stored.storyShown, true)
  assert.deepEqual(stored.seats['1'], { locationId: cells.id, round: s.round, source: '07260' })
  assert.equal('captured' in inv, false, '捕获状态只存 mechanicState，不写 inv')
})

test('被俘全局限制：不能移动/攻击/交战；伪造 validateMove 同样被拒；其他调查员正常', () => {
  const s = capturedFixture()
  const capturedSeat = 1
  // legalMoves 以 state.currentSeat 为行动者枚举；把回合交给被俘者来验证「列表里没有」。
  s.currentSeat = capturedSeat
  const moves = legalMoves(s)
  assert.equal(moves.some(command => ['move', 'shortcutMove', 'fight', 'engage'].includes(command.action)),
    false, '被俘者的合法列表没有移动/攻击/交战')
  const fakeMove = validateMove(s, capturedSeat, { action: 'move', locationId: s.investigators[0].location })
  assert.ok(fakeMove && /被俘/.test(fakeMove), `伪造移动被拒（${fakeMove}）`)
  const fakeFight = validateMove(s, capturedSeat, { action: 'fight', enemyId: 'nope' })
  assert.ok(fakeFight && /被俘/.test(fakeFight), `伪造攻击被拒（${fakeFight}）`)
  const fakeEngage = validateMove(s, capturedSeat, { action: 'engage', enemyId: 'nope' })
  assert.ok(fakeEngage && /被俘/.test(fakeEngage), `伪造交战被拒（${fakeEngage}）`)
  const inv = s.investigators[capturedSeat]
  assert.ok(/被俘/.test(movementError(s, inv, s.investigators[0].location)), 'movementError 读点拦截')
  // 回合还给未受影响的调查员：其合法列表正常。
  s.currentSeat = 0
  assert.ok(legalMoves(s).some(command => command.action === 'move'), '其他调查员行动不受影响')

  // 敌人不能与 captive 交战（即使剧本/效果强制交战，也走 engageEnemy 唯一写点）。
  const cells = locationOf(s, '07252b')
  const enemy = spawnEnemy(s, '07088', cells.id, null, true)
  assert.equal(enemy, null, '敌人不能生成在拘禁室')
  const manual = { id: 'enemy-test-captive', code: '07088', name: '测试敌人', location: cells.id,
    fight: 1, evade: 1, health: 5, damageTaken: 0, damage: 0, horror: 0, engagedSeat: null, traits: [] }
  s.enemies.push(manual)
  engageEnemy(s, manual, capturedSeat)
  assert.equal(s.enemies.find(item => item.id === manual.id).engagedSeat, null, '被俘者不能被交战')
  s.enemies = s.enemies.filter(item => item.id !== manual.id)
})

test('07252 首读：第一次被俘读剧情文本，后续只结算同样的物理效果', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const storyLines = () => s.log.filter(line => typeof line === 'string' && line.includes('紧锁的囚室')).length
  assert.equal(storyLines(), 0)
  asset(s, '01020', {}, 1)
  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07252', keysTo: 'destination' }))
  assert.equal(storyLines(), 1, '首次被俘读 07252 剧情文本')
  assert.equal(s.scenarioFlags.mechanics.captured.storyShown, true)

  // 第二位被俘：不再读文本，但同样的物理效果（返手/放到拘禁室/钥匙）照常结算。
  asset(s, '01030', {}, 0)
  createMechanicsApi(s).keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
  transaction(s, draft => scenarioRuntime(draft, []).capture(0, { source: '07260', keysTo: 'destination' }))
  assert.equal(storyLines(), 1, '后续被俘不再读文本')
  assert.deepEqual(capturedSeats(s), [0, 1])
  assert.ok(s.investigators[0].hand.includes('01030'), '后续被俘同样返手手槽支援')
  const cells = locationOf(s, '07252b')
  assert.equal(s.investigators[0].location, cells.id)
  assert.ok(keysAt(s, `location:${cells.id}`, { reveal: true }).includes('blue'))

  // 解救后可再次被俘；文本仍然只读一次。
  transaction(s, draft => scenarioRuntime(draft, []).freeCaptured(0))
  assert.equal(isCaptured(s, 0), false)
  transaction(s, draft => scenarioRuntime(draft, []).capture(0, { source: '07260', keysTo: 'destination' }))
  assert.equal(storyLines(), 1, '再次被俘也不重复读文本')
  assert.deepEqual(capturedSeats(s), [0, 1])
})

test('07252b 行动：战斗/敏捷(3)成功解救；控制黄钥匙自动成功；无被俘者时行动不出现', () => {
  // a) 无黄钥匙：选择战斗检定，chaosBag 的 0 自动通过 → 解救。
  {
    const s = capturedFixture()
    const cells = locationOf(s, '07252b')
    s.investigators[0].location = cells.id
    const action = actionOn(s, cells.id)
    assert.ok(action, '拘禁室行动出现在合法列表')
    assert.equal(capturedAtLocation(s, cells.id).length, 1)
    move(s, action)
    settle(s, choice => (choice.kind === 'skill' ? 'combat' : null))
    assert.equal(isCaptured(s, 1), false, '检定成功解救被俘者')
    assert.equal(actionOn(s, cells.id), undefined, '没有在押者时行动消失（criteria）')
  }
  // b) 控制黄色钥匙：不掷骰直接成功（打印「本次检定自动成功」）。
  {
    const s = capturedFixture()
    const cells = locationOf(s, '07252b')
    s.investigators[0].location = cells.id
    createMechanicsApi(s).keys.transfer('yellow', 'setAside', 'investigator:0', { reveal: true })
    const action = actionOn(s, cells.id)
    assert.ok(action)
    move(s, action)
    settle(s) // 行动后的免费能力窗口
    assert.equal(isCaptured(s, 1), false, '黄钥匙直接解救')
    assert.ok(s.log.some(line => typeof line === 'string' && line.includes('黄色钥匙')), '日志说明自动成功')
  }
})

test('07252b 地点限制：不能被淹没；敌人不能进入/生成（改到沉没岩洞，无候选时生成失败）', () => {
  const s = capturedFixture()
  const cells = locationOf(s, '07252b')
  const mechanics = createMechanicsApi(s)
  // 不能淹没
  assert.equal(mechanics.water.canChange(cells.id, 1), false, '拘禁室不能提升淹没等级')
  mechanics.water.change(cells.id, 1)
  assert.equal(floodLevel(s, cells.id), 0, '拘禁室不能被淹没')
  // 敌人不能进入
  assert.equal(enemyCanEnterLocation(s, { code: '07088', originalCode: '07088' }, cells.id), false)
  // 无候选（07244/45/46 未入场）→ 走既有生成失败：不进遭遇区
  assert.equal(spawnEnemy(s, '07088', cells.id, null, true), null)
  // 有候选（任意沉没岩洞入场）→ 生成被改到沉没岩洞
  placeAt(s, 'location07244', 2, -1)
  const grotto = locationOf(s, '07244')
  const redirected = spawnEnemy(s, '07088', cells.id, null, true)
  assert.ok(redirected, '生成请求被重定向而不是失败')
  assert.equal(redirected.location, grotto.id, '改在任意沉没岩洞生成')
  assert.equal(redirected.location === cells.id, false)
})

test('07260 惨遭俘虏：敏捷(4)失败被俘+钥匙放拘禁室；成功不受影响', () => {
  // 失败
  {
    const s = chapterFixture('aLightInTheFog', 2)
    s.chaosBag = ['-8'] // 必定失败的标记值
    createMechanicsApi(s).keys.transfer('red', 'setAside', 'investigator:1', { reveal: true })
    const card = { ...s.scenario.treacheries['07260'], id: 'treachery-07260' }
    transaction(s, draft => entry07260.encounterResolve(draft, draft.investigators[1], card, scenarioRuntime(draft, [])))
    assert.equal(isCaptured(s, 1), true, '敏捷检定失败 → 被俘')
    const cells = locationOf(s, '07252b')
    assert.equal(s.investigators[1].location, cells.id)
    assert.deepEqual(keysAt(s, `location:${cells.id}`, { reveal: true }), ['red'], '钥匙放拘禁室')
  }
  // 成功
  {
    const s = chapterFixture('aLightInTheFog', 2)
    s.investigators[1].testBonus = 10 // 敏捷 4 的检定必然成功（不受混乱标记影响）
    const card = { ...s.scenario.treacheries['07260'], id: 'treachery-07260' }
    transaction(s, draft => entry07260.encounterResolve(draft, draft.investigators[1], card, scenarioRuntime(draft, [])))
    assert.equal(isCaptured(s, 1), false, '敏捷检定成功 → 不被俘')
    assert.equal(locationOf(s, '07252b'), null, '没有首次被俘就不翻拘禁室')
  }
})

test('07253 奥赛罗思·马什：淹没时 +2 躲避；成功躲避按差值夺钥匙', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  const inv0 = s.investigators[0]
  transaction(s, draft => scenarioRuntime(draft, []).spawn('07253', draft.investigators[0].location))
  const marsh = enemyOf(s, '07253')
  assert.ok(marsh, '马什在场')
  const mechanics = createMechanicsApi(s)
  assert.equal(enemyEvadeValue(s, marsh, s.investigators[0]), 2, '未淹没：印刷躲避 2')
  mechanics.water.set(marsh.location, 1)
  assert.equal(enemyEvadeValue(s, enemyOf(s, '07253'), s.investigators[0]), 4, '地点淹没时 +2 躲避')
  const marshNow = enemyOf(s, '07253')
  mechanics.keys.transfer('blue', 'setAside', `enemy:${marshNow.id}`, { reveal: true })
  mechanics.keys.transfer('white', 'setAside', `enemy:${marshNow.id}`, { reveal: true })
  // 成功躲避，成功点数为 2 → 控制 2 把钥匙。
  transaction(s, draft => reactionWindow(draft, 'evadeSuccess', {
    when: 'evadeSuccess', seat: 0, location: draft.investigators[0].location,
    enemy: draft.enemies.find(item => codeOf(item) === '07253'), successBy: 2,
  }, []), choice => (choice.kind === 'effect' ? choice.options[0]?.id : null))
  assert.deepEqual(keysAt(s, 'investigator:0').sort(), ['blue', 'white'], '按成功差值夺走 2 把钥匙')
  assert.deepEqual(keysAt(s, `enemy:${enemyOf(s, '07253').id}`, { reveal: true }), [], '马什身上钥匙被拿走')
})

test('07253 敌军阶段攻击后被俘+钥匙放马什；非敌军阶段不触发', () => {
  const build = () => {
    const s = chapterFixture('aLightInTheFog', 2)
    transaction(s, draft => scenarioRuntime(draft, []).spawn('07253', draft.investigators[0].location))
    const mechanics = createMechanicsApi(s)
    const marsh = enemyOf(s, '07253')
    mechanics.keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
    mechanics.keys.transfer('green', 'setAside', 'investigator:0', { reveal: true })
    return { s, marsh }
  }
  // a) 敌军阶段：被俘 + 钥匙放马什
  {
    const { s } = build()
    s.phase = 'enemy'
    s.currentSeat = 0
    transaction(s, draft => reactionWindow(draft, 'enemyAttacked', {
      when: 'enemyAttacked', seat: 0, location: draft.investigators[0].location,
      enemy: draft.enemies.find(item => codeOf(item) === '07253'),
      attack: { kind: 'enemy', damage: 0, horror: 0, cancelled: false },
    }, []))
    const marshNow = enemyOf(s, '07253')
    assert.equal(isCaptured(s, 0), true, '敌军阶段攻击后被俘')
    const cells = locationOf(s, '07252b')
    assert.equal(s.investigators[0].location, cells.id, '被俘者放到拘禁室')
    assert.deepEqual(keysAt(s, `enemy:${marshNow.id}`, { reveal: true }).sort(), ['blue', 'green'],
      '所有钥匙放到马什身上')
  }
  // b) 非敌军阶段（如调查阶段的效果攻击）：不触发俘获
  {
    const { s } = build()
    s.phase = 'investigation'
    s.currentSeat = 0
    transaction(s, draft => reactionWindow(draft, 'enemyAttacked', {
      when: 'enemyAttacked', seat: 0, location: draft.investigators[0].location,
      enemy: draft.enemies.find(item => codeOf(item) === '07253'),
      attack: { kind: 'enemy', damage: 0, horror: 0, cancelled: false },
    }, []))
    assert.equal(isCaptured(s, 0), false, '非敌军阶段不俘获')
  }
})

test('07233 不变如海：被俘推进议程；毁灭移到下个密谋；背面全员被俘/马什放一边/地图扩张/直接推进 3a', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  // 走到议程 2a（07233）+ 场景 2a（07237）：07232b/07236b 的正常路径是直接推进，这里同样走直接推进。
  transaction(s, draft => scenarioRuntime(draft, []).advanceActDirectly())
  s.agendaIndex = 1
  s.doom = 2
  transaction(s, draft => scenarioRuntime(draft, []).spawn('07253', draft.investigators[0].location))
  const mechanics = createMechanicsApi(s)
  asset(s, '01020', {}, 1)
  mechanics.keys.transfer('red', 'setAside', 'investigator:1', { reveal: true })
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07233')
  assert.equal(codeOf(s.acts[s.actIndex]), '07237')

  // 1 号被俘 → 07233 的 forced「有调查员被俘时推进本密谋」→ 07233b 背面。
  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07260', keysTo: 'destination' }))

  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07234', '推进到下个密谋')
  assert.equal(s.doom, 2, '原密谋上的 2 个毁灭移动到下个密谋')
  assert.deepEqual(capturedSeats(s), [0, 1], '背面：每位调查员被俘（批量，不递归）')
  assert.equal(s.agendaIndex, 2, '只推进一次（batch 抑制递归）')
  assert.equal(s.investigators[1].hand.includes('01020'), true, '被俘者手槽支援返手')
  const cells = locationOf(s, '07252b')
  assert.ok(cells, '拘禁室入场')
  assert.ok(keysAt(s, `location:${cells.id}`).includes('red'))
  // 马什放在一边
  assert.equal(enemyOf(s, '07253'), null, '马什离场')
  assert.ok((s.setAsideEnemies || []).some(enemy => codeOf(enemy) === '07253'), '马什放在一边')
  // 地图扩张：07244 揭示入场、07245/07246 在正下方、潮水通道补到每行 4 个
  const upper = locationOf(s, '07244')
  const lower = locationOf(s, '07245')
  const final = locationOf(s, '07246')
  assert.ok(upper && upper.revealed, '揭示灯塔地下室（沉没岩洞浅层）')
  assert.ok(lower, '沉没岩洞（深层）入场')
  assert.ok(final, '沉没岩洞（底层）入场')
  const map = createMechanicsApi(s).map
  assert.deepEqual(map.position(lower.id), { x: 2, y: -2, isolated: false })
  assert.deepEqual(map.position(final.id), { x: 2, y: -3, isolated: false })
  for (const row of [0, -1, -2]) assert.equal(map.locations({ row }).length, 4, `第 ${row} 行正好 4 个地点`)
  // 洗入惨遭俘虏
  assert.equal(s.scenarioZones.setAside.includes('07260'), false, '惨遭俘虏全部离开场外')
  assert.equal(s.encounterDeck.filter(code => code === '07260').length, 2, '2 张惨遭俘虏洗入遭遇牌库')
  // 直接推进到场景 3a（不结算 2b）
  assert.equal(codeOf(s.acts[s.actIndex]), '07238', '直接推进到场景 3a')
  assert.equal(s.actIndex, 2)
  assert.equal(s.status, 'playing')
})

test('07233 onCaptured 只在该议程为当前议程时生效', () => {
  const s = chapterFixture('aLightInTheFog', 2)
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07232')
  transaction(s, draft => scenarioRuntime(draft, []).capture(1, { source: '07260', keysTo: 'destination' }))
  assert.equal(s.agendaIndex, 0, '当前议程是 07232：被俘不推进')
  assert.equal(isCaptured(s, 1), true)
})

test('存档 JSON 往返通过校验；非法 captured 存档被拒；观察投影公开可见', () => {
  const s = capturedFixture()
  const cells = locationOf(s, '07252b')
  // 往返
  const roundTrip = JSON.parse(JSON.stringify(s))
  assert.doesNotThrow(() => validateMechanicState(roundTrip), 'JSON 往返后 validateMechanicState 通过')
  // 非法存档：不存在的拘禁室
  const badLocation = JSON.parse(JSON.stringify(s))
  badLocation.scenarioFlags.mechanics.captured.seats['1'].locationId = 'location99999'
  assert.throws(() => validateMechanicState(badLocation), /被俘地点|地点/)
  // 非法存档：不存在的座位
  const badSeat = JSON.parse(JSON.stringify(s))
  badSeat.scenarioFlags.mechanics.captured.seats['99'] = { locationId: cells.id, round: 1, source: null }
  assert.throws(() => validateMechanicState(badSeat), /座位/)
  // 非法存档：坏字段
  const badField = JSON.parse(JSON.stringify(s))
  delete badField.scenarioFlags.mechanics.captured.storyShown
  assert.throws(() => validateMechanicState(badField))
  // 未捕获章节状态保持原样（旧存档无 captured 键）
  const fresh = chapterFixture('aLightInTheFog', 2)
  assert.equal(fresh.scenarioFlags.mechanics?.captured, undefined)
  assert.doesNotThrow(() => validateMechanicState(fresh))
  // 观察投影：旁观者/本人都能看到「被俘 + 拘禁室」
  for (const observer of [0, 1]) {
    const view = viewState(s, observer)
    const projected = view.investigators.find(inv => inv.seat === 1)
    assert.equal(projected.captured, true, `观察者 ${observer} 可见被俘标记`)
    assert.equal(projected.capturedAt, cells.id, `观察者 ${observer} 可见关押地点`)
    const other = view.investigators.find(inv => inv.seat === 0)
    assert.equal(other.captured, false)
  }
})
