import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignView } from '../src/campaign/campaign.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { eliminateInvestigator, enemiesEngagedWith, enemyPhase, investigatorMoveDestinations,
  relocateEnemy, scenarioRuntime, startScenario, stepToward } from '../src/engine/engine.js'
import { createHarmThreat } from '../src/engine/harm-threat.js'
import { validateMechanicState } from '../src/engine/mechanic-state.js'
import { migrateState } from '../src/engine/save-migration.js'
import { asset, enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { applyPhysicalFace } from '../src/engine/physical-faces.js'
import { viewState } from '../src/integration/observation.js'
import { mechanicSnapshot, maskMechanicSnapshot } from '../src/integration/mechanic-view.js'
import { scriptActionHints } from '../src/engine/engine.js'
import { answer } from './core-fixture.mjs'
import { tdcInteractionFixture, TDC_CONSOLE, TDC_ARTIFACT } from './tdc-interaction-fixture.mjs'
// TDC_ARTIFACT 现在是真实单卡条目 11550（见 fixture 注释）；测试仍从同一常量取卡号。

const restored = state => {
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  return saved
}

const tdcAction = (state, abilityIndex) => move(state, { action: 'ability', assetId: TDC_CONSOLE, abilityIndex })
const tdcPick = (state, index = 0) => {
  answer(state, `pick:${index}`)
  answer(state, 'confirm')
}

test('TDC P4 任务候选去重，待决选择和进度按座位投影，取消及恢复保留正确状态', () => {
  let state = tdcInteractionFixture()
  tdcAction(state, 0)
  const own = viewState(state, 0)
  const other = viewState(state, 1)
  assert.deepEqual(own.pendingChoice.options.map(option => option.id), ['pick:0', 'pick:1', 'cancel'])
  assert(!JSON.stringify(own).includes('私人任务·守岸'))
  assert.equal(other.pendingChoice, null)
  assert.equal(other.mechanics.tdc.task.progress, 2)
  assert.match(validateMove(state, 1, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'pick:0' }), /应答时机/)
  answer(state, 'cancel')
  assert.equal(viewState(state, 0).mechanics.tdc.task.remaining, 2)
  tdcAction(state, 0)
  answer(state, 'pick:0')
  state = restored(state)
  answer(state, 'confirm')
  assert.equal(viewState(state, 0).mechanics.tdc.task.progress, 0)
  assert.equal(viewState(state, 0).mechanics.tdc.task.label, '绘制海岸地图')
  assert.equal(viewState(state, 2).mechanics.tdc.task.remaining, 1)
  tdcAction(state, 0)
  assert.equal(state.pendingChoice, null)
  state.skillTest = { seat: 1 }
  assert.equal(maskMechanicSnapshot(mechanicSnapshot(state), 0).tdc.task, undefined)
})

test('TDC P4 远征路线、区域划除及字形只发布已确认记录，地点重排过滤冲突', () => {
  const state = tdcInteractionFixture()
  tdcAction(state, 1)
  tdcPick(state, 1)
  tdcAction(state, 2)
  assert.deepEqual(state.pendingChoice.options.map(option => option.label), ['西岸', '取消，保留原状态'])
  tdcPick(state)
  tdcAction(state, 2)
  assert.equal(state.pendingChoice, null)
  tdcAction(state, 3)
  tdcPick(state)
  tdcAction(state, 5)
  assert(!state.pendingChoice.options.some(option => option.label === '被占据的格子'))
  tdcPick(state)
  const projected = viewState(state, 0)
  assert.equal(projected.mechanics.tdc.route, 'west')
  assert.deepEqual(projected.mechanics.tdc.regions.map(row => row.crossed), [false, true])
  assert.deepEqual(projected.mechanics.tdc.glyphs.filter(row => row.translated), [{ letter: 'A', translated: true, text: '潮水' }])
  assert.equal(projected.mechanics.tdc.glyphs.length, 26)
  assert.equal(projected.mechanics.tdc.map.find(row => row.id === 'tdcSlope').y, 2)
  assert(!JSON.stringify(projected).includes('暗置地点的正面正文'))
  assert(!JSON.stringify(projected).includes('暗置译文'))
  assert(!JSON.stringify(projected).includes('异席已触发的私人分支'))
  assert(JSON.stringify(viewState(state, 1)).includes('异席已触发的私人分支'))
})

test('TDC P4 文物分配可取消并恢复，实际败退的平手只接受最近存活席位', () => {
  let state = tdcInteractionFixture()
  tdcAction(state, 4)
  tdcPick(state)
  answer(state, 'cancel')
  assert.equal(viewState(state, 0).mechanics.tdc.artifacts[0].holder, null)
  tdcAction(state, 4)
  tdcPick(state)
  state = restored(state)
  tdcPick(state, 1)
  const artifact = state.investigators[1].assets.find(item => item.code === TDC_ARTIFACT)
  assert(artifact)
  tdcAction(state, 6)
  assert.deepEqual(state.pendingChoice.options.map(option => option.label), ['领队', '同距调查员'])
  assert.match(validateMove(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'cancel' }), /无效/)
  tdcPick(state, 1)
  assert.equal(viewState(state, 0).mechanics.tdc.artifacts[0].holder, 2)
  assert.equal(state.investigators[2].assets.find(item => item.code === artifact.code).id, artifact.id)
})

test('TDC P4 部位目标与服务端合法动作一致，剧本动作归当前幕或议程', () => {
  for (const scriptCard of ['act', 'agenda']) {
    const state = tdcInteractionFixture({ scriptCard })
    const view = viewState(state, 0)
    const body = state.enemies.find(item => item.hasParts)
    const parts = state.enemies.filter(item => item.partOf === body.id)
    assert(!view.legalMoves.some(item => item.action === 'fight' && item.enemyId === body.id))
    assert(parts.every(part => view.mechanics.tdc.targets[part.id].fight === null))
    assert(view.legalMoves.some(item => item.action === 'explore' && item.scriptCard === scriptCard))
    assert(scriptActionHints(state, 0).some(item => item.action === 'explore' && item.scriptCard === scriptCard))
    assert(view.scriptActions.some(item => item.action === 'explore' && item.scriptCard === scriptCard))
    assert(!view.legalMoves.some(item => item.action === 'fight' && item.scriptCard))
  }
})

function multipartFixture() {
  const state = fixture()
  const body = enemy(state, { name: '主体', damage: 7, horror: 7 })
  const first = enemy(state, { name: '部位甲', engagedSeat: null, damage: 1, horror: 0 })
  const second = enemy(state, { name: '部位乙', engagedSeat: null, damage: 0, horror: 2, evade: 1 })
  assert.equal(scenarioRuntime(state, []).linkEnemyParts(body.id, [first.id, second.id]), true)
  return { state, body, first, second }
}

test('多部位敌人公开合法战斗目标，分别计算检定与部位伤害', () => {
  const { state, body, first, second } = multipartFixture()
  const ids = action => legalMoves(state, 0).filter(option => option.action === action).map(option => option.enemyId)
  assert.deepEqual(ids('fight'), [first.id, second.id])
  assert.deepEqual(ids('evade'), [first.id, second.id])
  assert.match(validateMove(state, 0, { action: 'fight', enemyId: body.id }), /敌人部位/)
  assert.match(validateMove(state, 0, { action: 'engage', enemyId: second.id }), /敌人主体/)
  assert.deepEqual(enemiesEngagedWith(state, state.investigators[0]).map(enemy => enemy.id), [body.id])

  move(state, { action: 'fight', enemyId: first.id })
  settle(state)
  assert.deepEqual(state.enemies.map(enemy => enemy.damageTaken), [0, 1, 0])
  const saved = restored(state)
  move(saved, { action: 'evade', enemyId: second.id })
  settle(saved)
  assert.equal(saved.enemies[0].exhausted, true)
  assert.equal(saved.enemies[0].engagedSeat, null)
  assert.deepEqual(saved.investigators[0].engaged, [])
  assert.deepEqual(saved.enemies.map(enemy => enemy.damageTaken), [0, 1, 0])
  assert.equal(legalMoves(saved, 0).some(option => option.action === 'evade' && option.enemyId === second.id), false)
})

test('多部位敌人普通攻击合计伤恐，失败的检定只触发目标部位的反击或警戒', () => {
  const normal = multipartFixture()
  enemyPhase(normal.state)
  assert.deepEqual([normal.state.investigators[0].damage, normal.state.investigators[0].horror], [1, 2])
  assert.equal(normal.body.exhausted, true)
  assert.equal(normal.first.engagedSeat, null)

  const retaliation = multipartFixture()
  retaliation.first.retaliate = true
  retaliation.state.chaosBag = ['autofail']
  move(retaliation.state, { action: 'fight', enemyId: retaliation.first.id })
  settle(retaliation.state)
  assert.deepEqual([retaliation.state.investigators[0].damage, retaliation.state.investigators[0].horror], [1, 0])

  const { state, body, second } = multipartFixture()
  second.alert = true
  state.chaosBag = ['autofail']
  move(state, { action: 'evade', enemyId: second.id })
  settle(state)
  const inv = state.investigators[0]
  assert.deepEqual([inv.damage, inv.horror], [0, 2])
  assert.deepEqual(inv.engaged, [body.id])
  assert.equal(!!state.enemies[0].exhausted, false)
})

test('多部位敌人移动、翻面、离场和存档验证保留实体链接', () => {
  const { state, body, first, second } = multipartFixture()
  const api = scenarioRuntime(state, [])
  const snapshot = JSON.stringify(state)
  assert.throws(() => api.linkEnemyParts(body.id, [first.id, first.id]), /多部位/)
  assert.equal(api.linkEnemyParts(body.id, [second.id]), false)
  assert.equal(api.linkEnemyParts('missing', [second.id]), false)
  assert.equal(JSON.stringify(state), snapshot)
  const dest = 'multipart-destination'
  state.locations.push({ id: dest, name: dest, connections: [], clues: 0 })
  relocateEnemy(state, first, dest, [], { skipAutoEngage: true })
  assert.ok(state.enemies.every(enemy => enemy.location === dest))
  const defs = {
    'ghoulMinion': { type: 'enemy', linkedCardCode: 'part-back' },
    'part-back': { type: 'enemy', linkedCardCode: 'ghoulMinion', health: 8, fight: 2, evade: 3, damage: 2, horror: 1 },
  }
  applyPhysicalFace(state, second, 'part-back', { definitionFor: code => defs[code] })
  const saved = restored(state)
  assert.deepEqual(saved.enemies.map(enemy => [enemy.id, enemy.partOf ?? null, enemy.location]),
    [[body.id, null, dest], [first.id, body.id, dest], [second.id, body.id, dest]])
  assert.equal(saved.enemies[2].code, 'part-back')
  const invalid = structuredClone(saved)
  invalid.enemies[1].partOf = 'missing'
  assert.throws(() => migrateState(invalid), /敌人部位存档/)
  assert.equal(scenarioRuntime(saved, []).removeEnemyFromGame(saved.enemies[0]), true)
  assert.deepEqual(saved.enemies, [])
  assert.deepEqual(saved.removedFromGame.slice(-3), ['ghoulMinion', 'part-back', 'ghoulMinion'])
  restored(saved)
})

test('整行只与相邻行相连，移动格子后通路和载物随地点更新', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const origin = inv.location
  const here = state.locations.find(location => location.id === origin)
  const place = id => state.locations.push({ id, name: id, connections: [], clues: 0, revealed: true })
  for (const id of ['same', 'lower', 'far', 'isolated']) place(id)
  here.clues = 2
  const map = scenarioRuntime(state, []).mechanics.map
  map.configure({ adjacency: 'rows' })
  map.place(origin, 0, 0)
  map.place('same', 7, 0)
  map.place('lower', 4, 1)
  map.place('far', 2, 2)
  map.place('isolated', 10, 1, { isolated: true })
  assert.deepEqual(here.connections, ['lower'])
  assert.deepEqual(map.paths(origin, 'far'), [[origin, 'lower', 'far']])
  assert.equal(stepToward(state, origin, 'far'), 'lower')
  assert.ok(investigatorMoveDestinations(state, inv.seat, {}).includes('lower'))
  assert.equal(investigatorMoveDestinations(state, inv.seat, {}).includes('same'), false)

  const before = JSON.stringify(state)
  assert.equal(map.relocate([{ id: origin, x: 4, y: 1 }]), false)
  assert.throws(() => map.configure({ adjacency: 'invalid' }), /Invalid grid adjacency/)
  assert.equal(JSON.stringify(state), before)
  assert.equal(map.relocate([{ id: origin, x: 0, y: 2 }]), true)
  assert.equal(here.clues, 2)
  assert.equal(inv.location, origin)
  assert.deepEqual(map.paths(origin, 'same'), [[origin, 'lower', 'same']])
  const saved = restored(state)
  validateMechanicState(saved)
  assert.deepEqual(scenarioRuntime(saved, []).mechanics.map.position(origin), { x: 0, y: 2, isolated: false })
  saved.scenarioFlags.mechanics.gridAdjacency = 'invalid'
  assert.throws(() => validateMechanicState(saved), /Invalid grid adjacency/)
})

test('被击败后将同一支援移交给最近的幸存者，并保留计数和所有者', () => {
  assert.throws(() => registerCardAbilities({ code: 'handoff-invalid', transferOnControllerDefeat: 'farthest' }), /transferOnControllerDefeat/)
  const code = 'handoff-nearest-test'
  registerCardAbilities({ code, transferOnControllerDefeat: 'nearest' })
  const state = fixture('01001', 3)
  const [owner, nearby, distant] = state.investigators
  state.locations.push({ id: 'distant', connections: [owner.location] })
  state.locations.find(location => location.id === owner.location).connections = ['distant']
  distant.location = 'distant'
  nearby.location = owner.location
  const relic = asset(state, code, { uses: 2, exhausted: true, ownerSeat: owner.seat })
  owner.defeated = true
  eliminateInvestigator(state, owner, [])
  assert.equal(nearby.assets[0], relic)
  assert.equal(owner.assets.length, 0)
  assert.equal(distant.assets.length, 0)
  eliminateInvestigator(state, owner, [])
  assert.deepEqual(restored(state).investigators[nearby.seat].assets, [relic])
})

test('支援交接只允许并列最近的人；撤退、无人接手时不转移', () => {
  const code = 'handoff-tie-test'
  const build = () => {
    const state = fixture('01001', 4)
    const [owner, nearest, tied, distant] = state.investigators
    nearest.location = tied.location = owner.location
    state.locations.push({ id: 'distant', connections: [owner.location] })
    state.locations.find(location => location.id === owner.location).connections = ['distant']
    distant.location = 'distant'
    owner.defeated = true
    return { state, owner, relic: asset(state, code) }
  }
  let answer = '3'
  let transfers = 0
  const api = createHarmThreat({
    registeredEntry: key => key === code ? { transferOnControllerDefeat: 'nearest' } : null,
    aliveInvestigators: state => state.investigators.filter(inv => !inv.resigned && !inv.defeated),
    requestChoice: (_state, spec) => { assert.deepEqual(spec.options.map(option => option.id), ['1', '2']); return answer },
    triggerReaction: () => {},
    placeCluesOnLocation: () => {},
    scenarioBehavior: () => ({ assetControlChanged: () => { transfers += 1 } }),
    scenarioRuntime: () => ({}),
  })
  const { state, owner, relic } = build()
  assert.throws(() => api.eliminateInvestigator(state, owner, []), /无效的支援接管目标/)
  assert.deepEqual(owner.assets, [relic])
  assert.equal(transfers, 0)
  answer = '2'
  api.eliminateInvestigator(state, owner, [])
  assert.deepEqual(state.investigators[2].assets, [relic])
  assert.equal(transfers, 1)

  const lone = build()
  lone.state.investigators.slice(1).forEach(inv => { inv.resigned = true })
  api.eliminateInvestigator(lone.state, lone.owner, [])
  assert.deepEqual(lone.owner.assets, [lone.relic])
  const withdrawal = build()
  withdrawal.owner.defeated = false
  withdrawal.owner.resigned = true
  api.eliminateInvestigator(withdrawal.state, withdrawal.owner, [])
  assert.deepEqual(withdrawal.owner.assets, [withdrawal.relic])
  assert.equal(transfers, 1)
})

test('独立牌库从指定端依序取牌，弃牌仅回本牌库并可在空时回收', () => {
  const state = fixture()
  const mainPiles = structuredClone([state.encounterDeck, state.encounterDiscard])
  const decks = scenarioRuntime(state, []).mechanics.scenarioDecks
  decks.initialize('fixtureActions', ['a', 'b', 'c'], { shuffle: false })
  assert.deepEqual(decks.take('fixtureActions', 2, { from: 'bottom' }), ['a', 'b'])
  decks.discard('fixtureActions', 'a', { recycleWhenEmpty: true })
  assert.deepEqual(decks.cards('fixtureActions'), ['c'])
  const saved = restored(state)
  const next = scenarioRuntime(saved, []).mechanics.scenarioDecks
  assert.deepEqual(next.take('fixtureActions'), ['c'])
  next.discard('fixtureActions', 'b', { recycleWhenEmpty: true })
  assert.deepEqual(next.cards('fixtureActions').sort(), ['a', 'b'])
  assert.deepEqual([saved.encounterDeck, saved.encounterDiscard], mainPiles)
  const before = JSON.stringify(saved)
  assert.throws(() => next.take('fixtureActions', 1, { from: 'middle' }), /Invalid scenario deck end/)
  assert.throws(() => next.take('unknown', 1), /not initialized/)
  assert.throws(() => next.discard('fixtureActions', 'c', { recycleWhenEmpty: 'yes' }), /Invalid discard/)
  assert.equal(JSON.stringify(saved), before)
})

test('进度指派按调查员去重，跨章记录按结算标识幂等且下限为零', () => {
  const state = fixture('01001', 2)
  const progress = scenarioRuntime(state, []).mechanics.progress
  assert.equal(progress.claim('fixtureProgress', 0, 'first'), true)
  assert.equal(progress.claim('fixtureProgress', 1, 'first'), false)
  assert.equal(progress.claim('fixtureProgress', 0, 'second'), false)
  assert.equal(progress.claim('fixtureProgress', 1, 'second'), true)
  assert.equal(progress.change('fixtureProgress', 0, 2, 'firstChapterExit'), 2)
  assert.equal(progress.change('fixtureProgress', 1, -1, 'firstChapterExit'), 0)
  assert.equal(progress.change('otherProgress', 0, 1), false)
  assert.throws(() => progress.change('fixtureProgress', 0, 0), /非零整数/)
  assert.throws(() => progress.claim('constructor', 1, 'third'), /无效进度记录标识/)
  assert.throws(() => progress.change('fixtureProgress', 2, 1), /无效调查员座位/)

  const saved = restored(state)
  const next = scenarioRuntime(saved, []).mechanics.progress
  assert.deepEqual(next.forSeat('fixtureProgress', 0), { option: 'first', value: 2 })
  assert.equal(next.change('fixtureProgress', 0, 2, 'firstChapterExit'), false)
  assert.equal(next.change('fixtureProgress', 0, -8, 'secondChapterExit'), 0)
  assert.deepEqual(next.forSeat('fixtureProgress', 1), { option: 'second', value: 0 })
  assert.equal(campaignView(saved.campaign, 1).progressTracks, undefined)
  startScenario(saved, 1, [])
  const continued = scenarioRuntime(saved, []).mechanics.progress
  assert.deepEqual(continued.forSeat('fixtureProgress', 0), { option: 'first', value: 0 })
  const previousOwner = saved.campaign.investigators[0].id
  saved.campaign.investigators[0].id = 'replacement-fixture'
  assert.equal(continued.forSeat('fixtureProgress', 0), null)
  saved.campaign.progressTracks.fixtureProgress[previousOwner].value = -1
  assert.throws(() => migrateState(saved), /无效进度记录/)
})
