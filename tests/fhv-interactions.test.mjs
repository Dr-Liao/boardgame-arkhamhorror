// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P4 交互事务 Node 验收。
//
// 口径（docs/campaign/theFeastOfHemlockVale/README.md §3 P4 与 P1 扫描的 4 组交互机制）：
//   · 所有玩家决策走 selectMechanic 的 pending choice（opaque pick:N / confirm / cancel）；
//   · 空强制候选 = 直接返回 false/null，且不留 pending choice（无软锁）；
//   · 取消发生在任何写入之前（半写状态 = 0）；
//   · 隐藏信息（未触发法典条目的分支条件、猎杀袋内标记、他人手牌卡号）不进选择标签或观察投影；
//   · 审计账本 audit/fhv-interactions.json 必须由 buildInteractionAudit() 逐字节复算。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFhvInteractions } from '../src/engine/fhv-interactions.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { MECHANIC_OPERATIONS } from '../src/engine/mechanic-choices.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { normalizeScenarioMechanics, validateMechanicState } from '../src/engine/mechanic-state.js'
import { setScenarioDate } from '../src/engine/scenario-calendar.js'
import { configureGrid, placeGridLocation } from '../src/engine/grid-map.js'
import { configureRailGrid } from '../src/engine/rail-grid.js'
import { registerVehicle } from '../src/engine/vehicles.js'
import { createTokenBag } from '../src/engine/token-bag.js'
import { mechanicView, maskMechanicSnapshot, mechanicSnapshot } from '../src/integration/mechanic-view.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { fixture, asset } from './core-fixture.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const readJson = path => JSON.parse(readFileSync(join(MOD, path), 'utf8'))
const copy = value => JSON.parse(JSON.stringify(value))

const CAMPAIGN_ID = 'theFeastOfHemlockVale'
const RESIDENTS = [
  { id: 'motherRachel', name: '母亲瑞秋', nameEn: 'Mother Rachel',
    record: { level: 'motherRachelTrust', notes: 'motherRachelNotes', crossedOut: 'motherRachelGone', max: 4 } },
]
const CODEX = [
  { id: 'motherRachel', limit: 'scenario',
    resident: { relationship: 'motherRachelTrust', notes: 'motherRachelNotes', crossedOut: 'motherRachelGone' },
    branches: [
      { id: 'mr-low', minRelationship: 0, maxRelationship: 1 },
      { id: 'mr-mid', minRelationship: 2, maxRelationship: 2, notes: ['helped'] },
      { id: 'mr-high', minRelationship: 3 },
    ] },
  { id: 'boardingHouse', limit: 'act', branches: [{ id: 'bh-1' }] },
]

function makeState({ seats = 1, records = {}, survey = false, grid = false, rail = false, enemyLocation = false } = {}) {
  const state = fixture('01001', seats)
  state.humanSeats = Array.from({ length: seats }, (_, seat) => seat)
  state.currentSeat = 0
  state.turnSeat = 0
  state.round = 2
  for (const location of state.locations) location.revealed = true
  state.campaign.id = CAMPAIGN_ID
  state.campaign.leadSeat = 0
  state.campaign.records = {
    motherRachelTrust: 2, motherRachelNotes: ['helped'], motherRachelGone: false,
    ...records,
  }
  const record = state.campaign.investigators[0]
  record.deck = ['01016', '01018', '01088']
  record.status = 'active'
  state.scenario.id = 'fhvInteractionFixture'
  state.scenario.name = '交互夹具'
  const spec = {
    calendar: { maximumDay: 3, record: 'dayTime', periodByLocationTrait: 'Dark' },
    codex: CODEX.map(entry => ({ ...entry, branches: entry.branches.map(branch => ({ ...branch })), ...(entry.resident ? { resident: { ...entry.resident } } : {}) })),
    residents: RESIDENTS.map(row => ({ ...row, record: { ...row.record } })),
    ...(survey ? { survey: { destinations: ['writtenInRock', 'hemlockHouse'], resolutions: null } } : {}),
  }
  state.scenario.mechanics = normalizeScenarioMechanics(spec)
  setScenarioDate(state, 2, 'day')
  state.tokenBags = {}
  if (grid) {
    for (const [id, name] of [['l1', '北角矿井'], ['l2', '采矿场'], ['l3', '十字路口'], ['newSite', '岩缝'], ['newSite2', '废料堆']]) {
      state.locations.push({ id, name, nameEn: name, code: id, revealed: true, clues: 0, shroud: 2, traits: [], connections: [], attachments: [] })
    }
    configureGrid(state, { adjacency: 'orthogonal' })
    const here = state.investigators[0].location
    placeGridLocation(state, here, 0, 0, {}, {})
    placeGridLocation(state, 'l1', 0, -1, {}, {})
    placeGridLocation(state, 'l2', 1, 0, {}, {})
    placeGridLocation(state, 'l3', -1, 0, {}, {})
  }
  if (rail) {
    const here = state.investigators[0].location
    registerVehicle(state, 'mineCart', { location: here, capacity: 4, running: true })
    configureRailGrid(state, 'mineCart', 'north', {
      [here]: ['north', 'east'], l1: ['south', 'east', 'west'], l2: ['north', 'west'], l3: ['east'],
    }, options => configureGrid(state, options))
    state.locations.find(location => location.id === here).connections = ['l1']
  }
  if (enemyLocation) {
    const here = state.investigators[0].location
    createMechanicsApi(state).turnLocationIntoEnemy(here, {
      code: 'livingRoom', name: '活化的会客厅', shroud: 2, traits: ['House'],
      fight: 2, evade: 1, health: 4, damage: 1, horror: 1, victory: 0,
    })
  }
  return state
}

// 事务驱动：execute 在每次重放时用同一 action 从 draft 重建交互层（与引擎 ctx.api 接线一致）。
function drive(state, seat, action, answers = []) {
  let result
  const execute = draft => { result = action(draft); return result }
  resolveTransaction(state, seat, { action: 'fhvInteraction' }, execute)
  const run = {
    seat, execute,
    get result() { return result },
    get choice() { return state.pendingChoice },
  }
  run.answer = optionId => {
    assert.ok(state.pendingChoice, `没有待决选择可以回答 ${optionId}`)
    resolveTransaction(state, seat, { action: 'choose', choiceId: state.pendingChoice.id, optionId }, execute)
    return run
  }
  for (const optionId of answers) run.answer(optionId)
  return run
}
const pickAndConfirm = (run, index = 0) => { run.answer(`pick:${index}`); run.answer('confirm') }

test('P4 机制操作表：既有 25 项保持不变，追加 FHV 7 项交互事务', () => {
  assert.ok(Object.isFrozen(MECHANIC_OPERATIONS))
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(0, 10)],
    ['seal', 'release', 'claimKey', 'giveKeys', 'spendKey', 'enterVehicle', 'leaveVehicle', 'driveVehicle', 'commitOrigin', 'returnCommitment'])
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(10, 19)],
    ['eoteFrost', 'eotePartner', 'eoteSeal', 'eoteKey', 'eoteTekeli', 'eoteDeckTop', 'eoteCrossSeat', 'eoteDiscipline', 'eoteSupply'])
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(19, 25)],
    ['tskConcealed', 'tskKey', 'tskHollow', 'tskMap', 'tskCustomizable', 'tskCrossSeat'])
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(25, 32)],
    ['fhvCodex', 'fhvSurvey', 'fhvGrid', 'fhvRail', 'fhvPredation', 'fhvForm', 'fhvClue'])
  assert.equal(new Set(MECHANIC_OPERATIONS).size, MECHANIC_OPERATIONS.length)
  // P1 扫描的 4 组交互机制都有对应的事务操作。
  const scan = readJson('audit/fhv-mechanism-scan.json')
  const interactions = scan.mechanisms.filter(row => row.type === 'interaction').map(row => row.id)
  assert.deepEqual(interactions, ['interaction.codex', 'interaction.timeAndSurvey', 'interaction.gridAndPredation', 'interaction.investigatorState'])
})

test('P4 法典：候选只含可读条目，取消零写入，条件段落筛选，限次后空候选不暂停', () => {
  const state = makeState()
  // 关系等级 2 + 笔记 helped → 命中 mr-mid；未满足条件的条目不出现在候选。
  let effectBranch = null
  const run = drive(state, 0, draft => createFhvInteractions(draft).codex.read(0, {
    effect: ({ branch }) => { effectBranch = branch },
  }))
  assert.equal(run.choice.source.operation, 'fhvCodex')
  assert.ok(run.choice.options.every(option => !/mr-low|mr-high/.test(option.label)))
  pickAndConfirm(run)
  assert.equal(run.result.entry, 'motherRachel')
  assert.equal(run.result.branch, 'mr-mid')
  assert.equal(effectBranch, 'mr-mid')
  // 取消：不写 resolvedCodex、不调用效果。
  const before = copy(state.scenarioFlags.mechanics.resolvedCodex || [])
  const cancel = drive(state, 0, draft => createFhvInteractions(draft).codex.read(0))
  cancel.answer('cancel')
  assert.equal(cancel.result, false)
  assert.deepEqual(state.scenarioFlags.mechanics.resolvedCodex || [], before)
  // 第二个条目（act 限次）仍可读；读完后空候选直接返回 false 且不留 pending choice。
  const second = drive(state, 0, draft => createFhvInteractions(draft).codex.read(0))
  pickAndConfirm(second)
  assert.equal(second.result.entry, 'boardingHouse')
  const empty = drive(state, 0, draft => createFhvInteractions(draft).codex.read(0))
  assert.equal(empty.result, false)
  assert.equal(state.pendingChoice, null)
  // 关系等级 3 时 mr-high 命中；划除居民后该条目不可读（空候选）。
  state.campaign.records.motherRachelTrust = 3
  delete state.scenarioFlags.mechanics.resolvedCodex
  const high = drive(state, 0, draft => createFhvInteractions(draft).codex.read(0))
  pickAndConfirm(high)
  assert.equal(high.result.branch, 'mr-high')
  state.campaign.records.motherRachelGone = true
  state.scenarioFlags.mechanics.resolvedCodex = ['boardingHouse:0']
  const crossed = drive(state, 0, draft => createFhvInteractions(draft).codex.read(0))
  assert.equal(crossed.result, false)
  assert.equal(state.pendingChoice, null)
  assert.equal(createFhvInteractions(state).codex.entries().find(entry => entry.id === 'motherRachel').available, false)
  validateMechanicState(copy(state))
})

test('P4 序曲整备：保留 1 张非起始支援、弃手牌到开手上限，然后选择下一场勘察；取消不写', () => {
  const state = makeState({ survey: true })
  const inv = state.investigators[0]
  asset(state, '01016', { id: 'keep-a' })
  asset(state, '01018', { id: 'keep-b' })
  inv.hand = ['01088', '01088', '01088', '01088', '01088', '01090']
  inv.resources = 30
  // 整备取消语义：在资产/手牌选择中取消 = 中止本次结算、不写包裹。
  const cancelPrepare = drive(state, 0, draft => createFhvInteractions(draft).survey.prepare(0))
  assert.equal(cancelPrepare.choice.source.stage, 'asset')
  cancelPrepare.answer('cancel')
  assert.equal(cancelPrepare.result, false)
  assert.equal(state.campaign.surveyPreparation, undefined)
  const prep = drive(state, 0, draft => createFhvInteractions(draft).survey.prepare(0))
  assert.equal(prep.choice.source.operation, 'fhvSurvey')
  assert.equal(prep.choice.source.stage, 'asset')
  prep.answer('pick:0'); prep.answer('confirm')
  // 手牌 6 > 开手 5：第二次选择弃 1 张。
  assert.equal(prep.choice.source.stage, 'card')
  prep.answer('pick:0'); prep.answer('confirm')
  assert.ok(prep.result)
  const parcel = state.campaign.surveyPreparation
  assert.equal(parcel.seats[0].assets.length, 1)
  assert.equal(parcel.seats[0].hand.length, 5)
  assert.equal(parcel.seats[0].resources, 5)
  // 选择下一场勘察关卡：取消零写入，合法选择写入包裹。
  const cancel = drive(state, 0, draft => createFhvInteractions(draft).survey.chooseNext(0))
  assert.equal(cancel.choice.source.operation, 'fhvSurvey')
  assert.equal(cancel.choice.source.stage, 'destination')
  cancel.answer('cancel')
  assert.equal(cancel.result, false)
  assert.equal(state.campaign.surveyPreparation.chosenDestination, undefined)
  const choose = drive(state, 0, draft => createFhvInteractions(draft).survey.chooseNext(0))
  assert.equal(choose.choice.source.operation, 'fhvSurvey')
  assert.equal(choose.choice.source.stage, 'destination')
  pickAndConfirm(choose)
  assert.equal(state.campaign.surveyPreparation.chosenDestination, state.campaign.surveyPreparation.destinations[0])
  // 已经选过：再次触发直接返回 false（空状态，无面板）。
  const repeat = drive(state, 0, draft => createFhvInteractions(draft).survey.chooseNext(0))
  assert.equal(repeat.result, false)
  // 重复整备不产生第二次包裹（返回 false，不留 pending choice）。
  const again = drive(state, 0, draft => createFhvInteractions(draft).survey.prepare(0))
  assert.equal(again.result, false)
  assert.equal(state.pendingChoice, null)
  validateMechanicState(copy(state))
})

test('P4 网格：正交空位放置合法/取消/无空位；滑动方案原子提交', () => {
  const state = makeState({ grid: true })
  const inv = state.investigators[0]
  const anchor = inv.location
  // 合法：唯一空位 (0,-1)。取消不写。
  const cancel = drive(state, 0, draft => createFhvInteractions(draft).grid.place(0, { locationId: 'newSite' }))
  cancel.answer('cancel')
  assert.equal(cancel.result, false)
  assert.equal(state.locations.find(location => location.id === 'newSite').grid, undefined)
  const place = drive(state, 0, draft => createFhvInteractions(draft).grid.place(0, { locationId: 'newSite' }))
  assert.equal(place.choice.source.operation, 'fhvGrid')
  pickAndConfirm(place)
  assert.deepEqual(place.result, { id: 'newSite', x: 0, y: 1 })
  assert.deepEqual(state.locations.find(location => location.id === 'newSite').grid, { x: 0, y: 1 })
  // 四个相邻格已满：再次放置不产生选择面板（空状态，无软锁）。
  const empty = drive(state, 0, draft => createFhvInteractions(draft).grid.place(0, { locationId: 'newSite2' }))
  assert.equal(empty.result, false)
  assert.equal(state.pendingChoice, null)
  // 滑动/交换：先校验全部坐标后一次性提交；非法计划不写状态。
  const plans = [
    { id: 'swap', label: '交换', changes: [{ id: 'l2', x: -1, y: 0 }, { id: 'l3', x: 1, y: 0 }] },
    { id: 'bad', label: '重叠', changes: [{ id: 'l2', x: 1, y: 0 }] },
  ]
  const slideCancel = drive(state, 0, draft => createFhvInteractions(draft).grid.slide(0, { plans }))
  slideCancel.answer('cancel')
  assert.equal(slideCancel.result, false)
  const slide = drive(state, 0, draft => createFhvInteractions(draft).grid.slide(0, { plans }))
  pickAndConfirm(slide)
  assert.deepEqual(slide.result.id, 'swap')
  assert.deepEqual(state.locations.find(location => location.id === 'l2').grid, { x: -1, y: 0 })
  const bad = drive(state, 0, draft => createFhvInteractions(draft).grid.slide(0, { plans: [plans[1]] }))
  pickAndConfirm(bad)
  assert.equal(bad.result, false)
  assert.deepEqual(state.locations.find(location => location.id === 'l2').grid, { x: -1, y: 0 })
  validateMechanicState(copy(state))
  void anchor
})

test('P4 矿车与道岔：转向合法性、前进方向选择、取消零写入、断轨记录', () => {
  const state = makeState({ grid: true, rail: true })
  const api = createFhvInteractions(state)
  assert.deepEqual(api.rail.status(), { vehicle: 'mineCart', location: state.investigators[0].location, facing: 'north', derailed: false, exits: ['north', 'east'] })
  // 道岔转向：当前朝北，垂直出口只有 east。
  const steer = drive(state, 0, draft => createFhvInteractions(draft).rail.steer(0))
  pickAndConfirm(steer)
  assert.deepEqual(steer.result, { facing: 'east' })
  assert.equal(state.scenarioFlags.mechanics.rail.facing, 'east')
  // 取消：保持朝东。
  const cancel = drive(state, 0, draft => createFhvInteractions(draft).rail.steer(0))
  cancel.answer('cancel')
  assert.equal(cancel.result, false)
  assert.equal(state.scenarioFlags.mechanics.rail.facing, 'east')
  // 前进需要选择方向：把朝向转回北再前进（北面矿井有东/西出口可选）。
  state.scenarioFlags.mechanics.rail.facing = 'north'
  const advance = drive(state, 0, draft => createFhvInteractions(draft).rail.advance(0))
  assert.equal(advance.choice.source.operation, 'fhvRail')
  pickAndConfirm(advance)
  assert.equal(advance.result.location, 'l1')
  assert.equal(advance.result.facing, 'east')
  assert.equal(state.locations.find(location => location.id === 'l1').id, 'l1')
  validateMechanicState(copy(state))
})

test('P4 猎杀袋：抽取不创建技能检定；转移需选择去向；袋空后空候选不暂停', () => {
  const state = makeState()
  createTokenBag(state, 'predation', ['skull', 'elder_thing'])
  const draw = drive(state, 0, draft => createFhvInteractions(draft).predation.draw(0))
  assert.equal(draw.result.transferred, false)
  assert.equal(typeof draw.result.token, 'string')
  assert.equal(state.skillTest, undefined)
  assert.equal(state.tokenBags.predation.tokens.length, 1)
  // 转移：抽取后选择去向 'chaos'，标记进入混乱袋。
  const chaosBefore = state.chaosBag.length
  const transfer = drive(state, 0, draft => createFhvInteractions(draft).predation.draw(0, {
    targets: [{ id: 'chaos', label: '混乱袋' }],
  }))
  assert.equal(transfer.choice.source.operation, 'fhvPredation')
  pickAndConfirm(transfer)
  assert.equal(transfer.result.transferred, true)
  assert.equal(state.chaosBag.length, chaosBefore + 1)
  assert.equal(state.tokenBags.predation.tokens.length, 0)
  // 袋空：直接返回 false（空候选不产生选择面板）。
  const empty = drive(state, 0, draft => createFhvInteractions(draft).predation.draw(0))
  assert.equal(empty.result, false)
  assert.equal(state.pendingChoice, null)
  validateMechanicState(copy(state))
})

test('P4 调查员状态：坚毅形态二选一（取消零写入）与线索搬移归属/空目标校验', () => {
  const state = makeState()
  const inv = state.investigators[0]
  inv.damage = 4
  inv.horror = 2
  const cancel = drive(state, 0, draft => createFhvInteractions(draft).investigatorState.form(0, {
    forms: ['10016a', '10016b'], context: { when: 'wouldDefeat', seat: 0, cause: 'damage' },
  }))
  cancel.answer('cancel')
  assert.equal(cancel.result, false)
  assert.equal(inv.form, undefined)
  assert.equal(inv.damage, 4)
  const form = drive(state, 0, draft => createFhvInteractions(draft).investigatorState.form(0, {
    forms: ['10016a', '10016b'], context: { when: 'wouldDefeat', seat: 0, cause: 'damage' },
  }))
  assert.equal(form.choice.source.operation, 'fhvForm')
  pickAndConfirm(form)
  assert.deepEqual(form.result, { seat: 0, code: '10016a', form: 'resolute' })
  assert.equal(state.investigators[0].cardCode, '10016a')
  assert.equal(state.investigators[0].damage, 0)
  // 线索搬移：只列 Science/Tool 且（emptyTarget 时）无线索的受控支援。
  asset(state, '01016', { id: 'clue-target', traits: ['Science'] })
  asset(state, '01018', { id: 'clue-full', traits: ['Tool'], clues: 1 })
  asset(state, '01020', { id: 'clue-other', traits: ['Ally'] })
  state.investigators[0].clues = 2
  const transfer = drive(state, 0, draft => createFhvInteractions(draft).investigatorState.transferClue(0, {
    count: 1, traits: ['Science', 'Tool'], emptyTarget: true,
  }))
  assert.equal(transfer.choice.source.operation, 'fhvClue')
  assert.ok(transfer.choice.options.every(option => !/clue-full|clue-other/.test(option.label)))
  pickAndConfirm(transfer)
  assert.deepEqual(transfer.result, { seat: 0, asset: 'clue-target', count: 1 })
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.investigators[0].assets.find(item => item.id === 'clue-target').clues, 1)
  // 无线索 / 无合法支援：空候选直接返回 false。
  state.investigators[0].clues = 0
  const empty = drive(state, 0, draft => createFhvInteractions(draft).investigatorState.transferClue(0))
  assert.equal(empty.result, false)
  assert.equal(state.pendingChoice, null)
  assert.throws(() => drive(state, 0, draft => createFhvInteractions(draft).investigatorState.form(0, { forms: ['not-a-card'] })), /无效坚毅形态卡号/)
  validateMechanicState(copy(state))
})

test('P4 隐私：未触法典分支、袋内标记、他人手牌卡号、未到达昼夜内容不进观察投影', () => {
  const state = makeState({ seats: 2, survey: true })
  createTokenBag(state, 'predation', ['skull'])
  state.scenario.mechanics.codex[0].branches[2].hiddenText = 'SECRET-BRANCH-TEXT'
  state.investigators[1].hand = ['SECRET-HAND-CARD']
  asset(state, '01016', { id: 'seat0-science', traits: ['Science'] })
  // 观察者座位 1：不显示座位 0 的手牌卡号与猎杀袋标记面。
  const view = mechanicView(state, 1)
  assert.ok(view.fhv, 'FHV 投影必须存在')
  const serialized = JSON.stringify(view.fhv)
  assert.equal(serialized.includes('SECRET-BRANCH-TEXT'), false)
  assert.equal(serialized.includes('SECRET-HAND-CARD'), false)
  assert.equal(serialized.includes('skull'), false)
  assert.ok(view.fhv.tokenBags.every(bag => bag.count === 1 && bag.id === 'predation'))
  assert.ok(view.fhv.codex.every(entry => Object.keys(entry).every(key =>
    ['id', 'name', 'resident', 'available', 'used'].includes(key))))
  // 未到达昼夜：投影只有当前日/时段，不含任何未来分支内容。
  assert.deepEqual(view.fhv.date, { day: 2, period: 'day', ...(view.fhv.date.localPeriod ? { localPeriod: view.fhv.date.localPeriod } : {}) })
  // 快照再次掩码不引入私有字段。
  const snapshot = maskMechanicSnapshot(mechanicSnapshot(state), 1)
  assert.equal(JSON.stringify(snapshot.fhv).includes('SECRET-BRANCH-TEXT'), false)
})

