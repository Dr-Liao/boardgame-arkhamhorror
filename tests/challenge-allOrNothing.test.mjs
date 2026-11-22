// 批次 2 · 调查员挑战：破釜沉舟（All or Nothing · 90011 / campaign allOrNothing）。
//
// 真实引擎验收：独立开局（调查员限制 / 起始 XP / 难度袋）→ 布置（5 地点、赌场管理员、
// 放一边区）→ 幕 1 目标与推进 → 幕 2 撤退与结局 1 → 存档 JSON 往返；另验议程推进 → 结局 2。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/allOrNothing/manifest.js'
import * as moduleEntry from '../content/campaigns/allOrNothing/scenarios/allOrNothing/index.js'

const scenarioEntry = moduleEntry.default ?? moduleEntry
const { ENCOUNTER_DECK } = moduleEntry

test('破釜沉舟注册期校验：内容包、遭遇组与剧本身份', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('allOrNothing').id, 'allOrNothing')
  assert.deepEqual(registry.getScenario('allOrNothing').resolutionIds,
    ['noResolution', 'resolution1', 'resolution2'])
  // 批次 2 Lead 裁决：挑战独立难度四档（side-stories.json difficultyLevels）。
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 17)
  assert.equal(campaign.chaosBags.standard.length, 17)
  assert.equal(campaign.chaosBags.hard.length, 17)
  assert.equal(campaign.chaosBags.expert.length, 16)
  assert.throws(() => createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [campaign],
    scenarios: [{ ...scenarioEntry, manifest: { ...scenarioEntry.manifest, requiredEncounterGroupIds: ['missingGroup'] } }],
  }), /缺少遭遇组/)
})

// 生产组合根已注册该挑战时直接复用；单独运行本文件时临时注册夹具。
if (!contentRegistry.getCampaign(campaign.id)) registerContentBundle({ campaigns: [campaign], scenarios: [scenarioEntry] })

const engine = await import('../src/engine/engine.js')
const deckbuilding = await import('../src/deck/deckbuilding.js')
const { migrateState } = await import('../src/engine/save-migration.js')
const { viewState } = await import('../src/integration/observation.js')
const { INVESTIGATORS } = await import('../src/cards/cards-data.js')

const players = [{ seat: 0, role: 'human' }]
const send = (state, action) => { move(state, { action }); settle(state) }
function move(state, command) {
  const seat = engine.decisionSeat(state)
  assert.equal(engine.validateMove(state, seat, command), null, JSON.stringify(command))
  return engine.applyMove(state, seat, command)
}
function settle(state, select = () => null) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 150, `Choice loop: ${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(candidate =>
      choice.options.some(option => option.id === candidate)) ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    move(state, { action: 'choose', choiceId: choice.id, optionId: id })
  }
}
function deckCodes() {
  return [...deckbuilding.buildDeck(INVESTIGATORS['90008']).playerCards]
}
function enterScenario(state) {
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '90008' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
}
function makeState(seed = 'all-or-nothing') {
  const state = engine.createGameState({ campaignId: 'allOrNothing', campaignHub: true, difficulty: 'standard', seed }, players)
  settle(state)
  return state
}

test('破釜沉舟：独立开局限制、起始 XP 与布置', () => {
  assert.throws(() => engine.createGameState({ campaignId: 'allOrNothing', playerInvestigator: '01001' }, players), /不能使用/)
  assert.throws(() => engine.createGameState({ campaignId: 'allOrNothing' }, [...players, { seat: 1 }]), /不足/)
  const state = makeState()
  assert.equal(state.campaign.opening.experience, 3)
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  send(state, 'hubGoSetup')
  assert.deepEqual(engine.legalMoves(state).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code), ['90008'])
  move(state, { action: 'hubSelectInvestigator', code: '90008' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.difficulty, 'standard')
  assert.equal(state.chaosBag.length, 17)
  assert.equal(state.locations.length, 5)
  assert.equal(state.investigators[0].location, 'laBellaLuna')
  // 遭遇牌库：本关固定 24 张（The House Always Wins 去掉赌场管理员 + bad_luck/naomi/rats + 午夜假面 5 诡计）。
  assert.equal(ENCOUNTER_DECK.length, 24)
  assert.equal(state.encounterDeck.length, 24)
  // 赌场管理员在俱乐部大厅。
  const pitBoss = state.enemies.find(enemy => enemy.code === '02078')
  assert.ok(pitBoss)
  assert.equal(pitBoss.location, 'cloverClubLounge')
  // 幕 1：不能撤退（月下美人的撤退入口被关闭）。
  assert.equal(state.scenario.resignAnywhere, false)
  assert.ok(engine.validateMove(state, 0, { action: 'resign' }) !== null)
  // 放一边：西尔班 + 4 名俱乐部保安 + 3 张地点。
  const aside = state.scenarioZones.setAside
  assert.equal(aside.filter(code => code === '90016').length, 4)
  assert.ok(aside.includes('90015'))
  // 存档往返。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.locations.length, 5)
  assert.equal(saved.encounterDeck.length, 24)
  assert.equal(viewState(saved, 0).campaign.opening.experience, 3)
})

test('破釜沉舟：幕 1 目标（回合结束 ≥15 资源）→ 幕 2 撤退 → 结局 1 与奖励', () => {
  const state = makeState('all-or-nothing-win')
  enterScenario(state)
  const skids = state.investigators[0]
  // 幕 1 目标：任一调查员回合结束时有 ≥15 资源。直接调用章节钩子（真实 scenarioRuntime api）。
  const runtime = engine.scenarioRuntime(state, [])
  skids.resources = 16
  assert.equal(moduleEntry.behavior.roundEnded(state, runtime), true)
  assert.equal(state.actIndex, 1)
  assert.equal(state.scenario.resignAnywhere, true)
  // 幕 1 背面在黑暗走廊生成 4 名保安 + 西尔班。
  assert.equal(state.enemies.filter(enemy => enemy.code === '90016').length, 4)
  assert.equal(state.enemies.filter(enemy => enemy.code === '90015').length, 1)
  // 幕 2：撤退时资源放上幕卡；全员撤退 → 推进幕 2 → 结局 1。
  skids.resources = 42
  move(state, { action: 'resign' })
  settle(state)
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(state.campaign.records.allOrNothingResolution, 'resolution1')
  assert.equal(state.campaign.records.allOrNothingResourcesOnAct, 42)
  // 参考：40+ 资源 → 「Skids」额外 1 点奖励经验；并记录下关额外 4 资源。
  assert.equal(state.campaign.records.allOrNothingNextScenarioResources, 4)
  assert.equal(state.campaign.investigators[0].earnedXp, 3 + 1)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.campaign.scenarioResults[0].resolution, 'resolution1')
})

test('破釜沉舟：议程推进 → 结局 2', () => {
  const state = makeState('all-or-nothing-lose')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.allOrNothingResolution, 'resolution2')
})

test('破釜沉舟：「Skids」被击败 → 结局 2', () => {
  const state = makeState('all-or-nothing-defeat')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.finished, true)
})
