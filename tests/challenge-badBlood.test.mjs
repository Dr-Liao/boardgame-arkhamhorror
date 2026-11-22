// 批次 2 · 调查员挑战：血海深仇（Bad Blood · 90020 / campaign badBlood）。
//
// 真实引擎验收：独立开局（调查员限制 / 起始 XP / 难度袋）→ 布置（8+1 地点、9 个记忆、
// 艾尔佩斯）→ 幕 1 收集记忆推进 → 结局 1 与经验/记录 → 存档 JSON 往返；
// 另验议程推进 → 结局 2、艾格尼丝被击败 → 结局 2。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/badBlood/manifest.js'
import * as moduleEntry from '../content/campaigns/badBlood/scenarios/badBlood/index.js'

const scenarioEntry = moduleEntry.default ?? moduleEntry
const { ENCOUNTER_DECK, RANDOM_LOCATION_IDS } = moduleEntry

test('血海深仇注册期校验：内容包、遭遇组与剧本身份', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('badBlood').id, 'badBlood')
  assert.deepEqual(registry.getScenario('badBlood').resolutionIds,
    ['noResolution', 'resolution1', 'resolution2'])
  // 批次 2 Lead 裁决：挑战独立难度四档（side-stories.json difficultyLevels）。
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 17)
  assert.equal(campaign.chaosBags.standard.length, 17)
  assert.equal(campaign.chaosBags.hard.length, 17)
  assert.equal(campaign.chaosBags.expert.length, 16)
  assert.throws(() => createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign],
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
  return [...deckbuilding.buildDeck(INVESTIGATORS['90017']).playerCards]
}
function enterScenario(state) {
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '90017' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
}
function makeState(seed = 'bad-blood') {
  const state = engine.createGameState({ campaignId: 'badBlood', campaignHub: true, difficulty: 'standard', seed }, players)
  settle(state)
  return state
}

test('血海深仇：独立开局限制、起始 XP 与布置', () => {
  assert.throws(() => engine.createGameState({ campaignId: 'badBlood', playerInvestigator: '01001' }, players), /不能使用/)
  assert.throws(() => engine.createGameState({ campaignId: 'badBlood' }, [...players, { seat: 1 }]), /不足/)
  const state = makeState()
  assert.equal(state.campaign.opening.experience, 3)
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  send(state, 'hubGoSetup')
  assert.deepEqual(engine.legalMoves(state).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code), ['90017'])
  move(state, { action: 'hubSelectInvestigator', code: '90017' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.difficulty, 'standard')
  // 每个挑战包声明四档难度袋，standard 为 17 枚。
  assert.equal(state.chaosBag.length, 17)
  // 布置：8 处固定地点 + 随机 1 张（共 9）；全员从薇尔玛餐厅开始。
  assert.equal(state.locations.length, 9)
  assert.equal(state.investigators[0].location, 'velmasDiner')
  const randomLocation = state.scenarioFlags.badBloodRandomLocation
  assert.ok(RANDOM_LOCATION_IDS.includes(randomLocation))
  assert.ok(state.locations.some(location => location.id === randomLocation))
  // 9 个记忆。
  assert.equal(state.locations.filter(location => (location.memory || 0) > 0).length, 9)
  // 艾尔佩斯在古董商店。
  const elspeth = state.enemies.find(enemy => enemy.code === '90023')
  assert.ok(elspeth)
  assert.equal(elspeth.location, 'curiositieShoppe')
  assert.equal(elspeth.alert, true)
  assert.equal(elspeth.retaliate, true)
  // 遭遇牌库与定义一致。
  assert.equal(ENCOUNTER_DECK.length, 27)
  assert.equal(state.encounterDeck.length, 27)
  // 存档往返。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.locations.length, 9)
  assert.equal(saved.scenarioFlags.badBloodRandomLocation, randomLocation)
})

test('血海深仇：收集全部 9 个记忆 → 结局 1 与记忆经验', () => {
  const state = makeState('bad-blood-win')
  enterScenario(state)
  const agnes = state.investigators[0]
  // 简化推进：把 8 个记忆标记为已由艾格尼丝收集，只留她当前地点 1 个记忆用幕 1 行动收集。
  const here = state.locations.find(location => location.id === agnes.location)
  for (const location of state.locations) location.memory = location === here ? 1 : 0
  state.scenarioFlags.badBloodAgnesMemories = 8
  agnes.clues = 2
  const collect = engine.legalMoves(state).find(row => row.rule === 'badBloodCollectMemory')
  assert.ok(collect, '艾格尼丝所在地点应有收集记忆的 [fast] 行动')
  move(state, { action: 'scenarioAction', rule: 'badBloodCollectMemory' })
  settle(state)
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(state.campaign.records.badBloodResolution, 'resolution1')
  assert.equal(state.campaign.records.badBloodAgnesMemories, 9)
  // 经验：艾格尼丝按「胜利点或记忆数取高」= 9 XP；earnedXp 含起始经验 3。
  assert.equal(state.campaign.investigators[0].earnedXp, 3 + 9)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.campaign.scenarioResults[0].resolution, 'resolution1')
})

test('血海深仇：议程推进 → 结局 2', () => {
  const state = makeState('bad-blood-lose')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.badBloodResolution, 'resolution2')
})

test('血海深仇：艾格尼丝被击败 → 结局 2', () => {
  const state = makeState('bad-blood-defeat')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.finished, true)
})
