import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, startScenario } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { captureTableState } from '../src/integration/presentation-state.js'
import { contentRegistry } from '../content/registered.js'

// P1 状态可视化：失落的时代把公开的剧本状态投影到前端（探索牌库只给张数、
// 弃牌堆/遗物/领队/复仇/伊格之怒/深度/石柱公开），不泄露牌堆顺序。
function launchTfa() {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-visibility' }, [{ seat: 0, role: 'human' }])
  const step = move => applyMove(state, 0, move)
  step({ action: 'hubGoSetup' })
  step({ action: 'hubSelectInvestigator', code: '04001' })
  step({ action: 'hubAutoDeck' })
  step({ action: 'hubDoneSeat' })
  step({ action: 'hubBeginScenario' })
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  return state
}

// 直接进入指定剧本（与真实引擎同一入口，不走大厅流程）：用于剧本内公开状态投影。
function launchScenario(scenarioId) {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-visibility-' + scenarioId }, [{ seat: 0, role: 'human' }])
  const ids = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, ids.indexOf(scenarioId), [])
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  return state
}

test('失落的时代：探索牌库只公开张数，弃牌堆公开内容', () => {
  const state = launchTfa()
  state.explorationDeck = ['04050', '04051', '04052']
  state.explorationDiscard = ['04071', '04072']
  const view = viewState(state, 0)
  assert.equal(view.exploration.deck, 3)
  assert.deepEqual(view.exploration.discard, ['04071', '04072'])
  // 牌库顺序是背面朝下的信息：投影里不能出现任何卡号数组。
  assert.equal(Array.isArray(view.exploration.deck), false)
  assert.equal(JSON.stringify(view.exploration).includes('04050'), false)
})

test('失落的时代：遗物位置、领队、复仇合计与伊格之怒都进入观察投影', () => {
  const state = launchTfa()
  const location = state.investigators[0].location
  state.relicOfAges = { code: '04061', location, seat: 0 }
  state.expeditionLeaderSeat = 0
  state.victoryDisplay = [
    { id: 'v1', code: '04200', victory: 1, vengeance: 2 },
    { id: 'v2', code: '04201', victory: 0, vengeance: 3 },
  ]
  state.campaign.records.yigsFury = 4
  const view = viewState(state, 0)
  assert.deepEqual(view.relicOfAges, { code: '04061', location, seat: 0, attachments: [] })
  assert.equal(view.expeditionLeaderSeat, 0)
  assert.equal(view.vengeance, 5)
  assert.equal(view.yigsFury, 4)
})

test('失落的时代：只公开深度／石柱两个剧本标记', () => {
  const state = launchTfa()
  state.scenarioFlags = { depthLevel: 3, pillars: 2, deepDark: 1, secretInternal: 'hidden', mappedOut: true }
  const view = viewState(state, 0)
  assert.deepEqual(view.scenarioFlagsPublic, { depthLevel: 3, pillars: 2 })
  assert.equal(JSON.stringify(view.scenarioFlagsPublic).includes('secretInternal'), false)
  assert.equal(JSON.stringify(view).includes('mappedOut'), false)
})

// 04094 一片漆黑放在密谋牌库旁：公开投影必须带实例卡号，并把卡面补进 view.cards，
// 否则前端只能显示卡号（读档后卡名退化成卡号）并且详情画不出卡面。
test('失落的时代：密谋牌库旁的实体卡进入观察投影并补齐卡面', () => {
  const state = launchTfa()
  delete state.cards['04094']
  state.agendaAside = [{ id: 'aside-1', code: '04094', originalCode: '04094' }]
  const view = viewState(state, 0)
  assert.deepEqual(view.agendaAside.map(card => card.code), ['04094'])
  assert.equal(view.cards['04094']?.nameZh, '一片漆黑')
  assert.equal(view.cards['04094']?.type, 'treachery')
})

test('其他战役不会凭空出现失落的时代字段', () => {
  const state = createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'notz-visibility' }, [{ seat: 0, role: 'human' }])
  const view = viewState(state, 0)
  assert.deepEqual(view.exploration, { deck: 0, discard: [] })
  assert.equal(view.relicOfAges, null)
  assert.equal(view.vengeance, 0)
  assert.equal(view.yigsFury, 0)
  assert.deepEqual(view.scenarioFlagsPublic, {})
})

test('观察投影按座位一致：公开状态不因观察者不同而改变', () => {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-visibility-two' }, [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  const step = (seat, move) => applyMove(state, seat, move)
  step(0, { action: 'hubGoSetup' })
  step(0, { action: 'hubSetLeader', leadSeat: 0 })
  for (const seat of [0, 1]) {
    step(seat, { action: 'hubSelectInvestigator', code: seat === 0 ? '04001' : '04002' })
    step(seat, { action: 'hubAutoDeck' })
    step(seat, { action: 'hubDoneSeat' })
  }
  step(0, { action: 'hubBeginScenario' })
  for (let guard = 0; state.pendingChoice && guard < 300; guard++) {
    const pending = state.pendingChoice
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  state.scenarioFlags = { depthLevel: 2, pillars: 1 }
  const first = viewState(state, 0)
  const second = viewState(state, 1)
  assert.deepEqual(first.scenarioFlagsPublic, second.scenarioFlagsPublic)
  assert.deepEqual(first.exploration, second.exploration)
  assert.equal(first.expeditionLeaderSeat, second.expeditionLeaderSeat)
  // 各自的手牌仍然私有。
  assert.notDeepEqual(first.investigators.map(inv => inv.hand), second.investigators.map(inv => inv.hand))
})

test('失落的时代：时间线（古代/现代地点）进入观察投影', () => {
  const state = launchTfa()
  state.locations = [
    { id: 'ancient-slot', code: '04174', originalCode: '04174', revealed: true, clues: 0 },
    { id: 'modern-slot', code: '53042', originalCode: '53042', revealed: true, clues: 1 },
    { id: 'jungle', code: '04069', originalCode: '04069', revealed: true, clues: 0 },
  ]
  const view = viewState(state, 0)
  assert.deepEqual(view.timeline, { ancient: 1, modern: 1 })
  // 非古代/现代地点不计数，也不会因为投影泄露别的状态。
  state.locations = []
  assert.deepEqual(viewState(state, 0).timeline, { ancient: 0, modern: 0 })
})

test('命运之线：亚历山卓、猎物、目的地与剧情卡线索进入观察投影', () => {
  const state = launchTfa()
  state.scenario.id = 'threadsOfFate'
  state.scenarioFlags.alejandro = { code: '04051', location: 'easttown' }
  state.scenarioFlags.ichtacasPrey = ['e1']
  state.scenarioFlags.ichtacasDestinations = ['downtown']
  state.enemies.push({ id: 'e1', code: '01172', name: '夜魇', location: 'easttown' })
  state.storyAssets.push({ id: 's1', code: '04118b', name: '亨利', clues: 2 })
  const view = viewState(state, 0)
  assert.deepEqual(view.threadsOfFate, {
    alejandro: { code: '04051', location: 'easttown', enemyId: null },
    prey: ['e1'],
    destinations: ['downtown'],
  })
  assert.equal(view.storyAssets.find(asset => asset.id === 's1').clues, 2)
})

test('幽嘶深渊：深度、追击区、瓦卢西亚之子与密谋附属进入观察投影', () => {
  const state = launchTfa()
  state.scenario.id = 'theDepthsOfYoth'
  state.scenarioFlags.depthLevel = 3
  state.scenarioZones.pursuit = ['04337']
  state.scenarioZones.childrenOfValusia = ['04299', '04299']
  state.agendas[0].attachments = [{ code: '04284', originalCode: '04284' }]
  const view = viewState(state, 0)
  assert.deepEqual(view.depths, {
    depthLevel: 3,
    pursuit: ['04337'],
    childrenOfValusia: ['04299', '04299'],
    agendaAttachments: ['04284'],
  })
})

// 玩家报告：破碎永世 4a 看不到古代遗物下已经附属了几处地点。附属在桌上就是压在遗物
// 卡下面的正面朝下地点卡：观察投影要把数量/清单挂回遗物实例，并给出幕目标进度。
test('破碎永世：附属到古代遗物的地点与 4a 目标进度进入观察投影与演出快照', () => {
  const state = launchScenario('shatteredAeons')
  const relic = { id: 'relic-instance', code: '04061', originalCode: '04061', exhausted: false }
  state.investigators[0].assets.push(relic)
  state.relicOfAges = { code: '04061', location: null, seat: 0 }
  state.actIndex = 3
  state.scenarioFlags.relicUnderneath = [{ id: 'mu', code: '04332', name: '姆大陆', victory: 1 }]
  const serverRelic = state.investigators[0].assets.find(item => item.id === 'relic-instance')
  const view = viewState(state, 0)
  assert.equal(view.relicOfAges.attachments.length, 1)
  assert.equal(view.relicOfAges.attachments[0].name, '姆大陆')
  // 单人局：修补裂痕的目标是 1 + 1 = 2 处。
  assert.deepEqual(view.relicOfAges.objective, { kind: 'count', current: 1, needed: 2 })
  assert.deepEqual(view.actObjectiveProgress, { kind: 'relic', current: 1, target: 2 })
  const asset = view.investigators[0].assets.find(item => item.id === 'relic-instance')
  assert.deepEqual(asset.attachments.map(item => item.code), ['04332'])
  assert.equal(asset.attachments[0].name, '姆大陆')
  assert.equal(asset.attachments[0].facedown, true)
  // 视图生成不得写权威状态（投影只改副本）。
  assert.equal(serverRelic.attachments, undefined)
  // 演出快照（信息提示/表现动画重绘）与实时观察同一口径。
  const snapshot = captureTableState(state, () => 0, () => 0)
  assert.deepEqual(snapshot.actObjectiveProgress, { kind: 'relic', current: 1, target: 2 })
  const snapshotAsset = snapshot.investigators[0].assets.find(item => item.id === 'relic-instance')
  assert.deepEqual(snapshotAsset.attachments.map(item => item.code), ['04332'])
})
