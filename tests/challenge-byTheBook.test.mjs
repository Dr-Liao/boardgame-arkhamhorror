// 批次 2 · 调查员挑战：循规蹈矩（By the Book · 90032 / campaign byTheBook）。
//
// 真实引擎验收：独立开局（调查员限制 / 起始 XP / 四档难度袋）→ 布置（9 地点、9 名同谋暗置、
// 罗兰 1 线索）→ 幕 1 翻开同谋 / 警察局谈判捕获 → 胜利区 10 名异教徒 → 结局 1 与记录/经验 →
// 存档 JSON 往返；另验议程 1 推进（Mr. Grey 入场）与议程 2 推进 → 结局 2、罗兰被击败 → 结局 2。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/byTheBook/manifest.js'
import * as moduleEntry from '../content/campaigns/byTheBook/scenarios/byTheBook/index.js'

const scenarioEntry = moduleEntry.default ?? moduleEntry
const { ENCOUNTER_DECK, CONSPIRATOR_CODES } = moduleEntry

test('循规蹈矩注册期校验：内容包、遭遇组与剧本身份', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('byTheBook').id, 'byTheBook')
  assert.deepEqual(registry.getScenario('byTheBook').resolutionIds,
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
  return [...deckbuilding.buildDeck(INVESTIGATORS['90024']).playerCards]
}
function enterScenario(state) {
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '90024' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
}
function makeState(seed = 'by-the-book') {
  const state = engine.createGameState({ campaignId: 'byTheBook', campaignHub: true, difficulty: 'hard', seed }, players)
  settle(state)
  return state
}

test('循规蹈矩：独立开局限制、起始 XP 与布置', () => {
  assert.throws(() => engine.createGameState({ campaignId: 'byTheBook', playerInvestigator: '01001' }, players), /不能使用/)
  assert.throws(() => engine.createGameState({ campaignId: 'byTheBook' }, [...players, { seat: 1 }]), /不足/)
  const state = makeState()
  assert.equal(state.campaign.opening.experience, 3)
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  send(state, 'hubGoSetup')
  assert.deepEqual(engine.legalMoves(state).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code), ['90024'])
  move(state, { action: 'hubSelectInvestigator', code: '90024' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.difficulty, 'hard')
  assert.equal(state.chaosBag.length, 17)
  // 布置：9 地点、9 名同谋暗置、罗兰从警察局开局并获得 1 线索。
  assert.equal(state.locations.length, 9)
  assert.equal(state.investigators[0].location, 'arkhamPoliceStation')
  assert.equal(state.locations.filter(location => Boolean(location.conspirator)).length, 9)
  const conspirators = state.locations.flatMap(location => [location.conspirator])
  assert.deepEqual(new Set(conspirators).size, new Set(CONSPIRATOR_CODES).size)
  assert.ok(state.investigators[0].clues >= 1)
  // 幕 1 + 2 议程；遭遇牌库与定义一致。
  assert.equal(state.acts.length, 1)
  assert.equal(state.agendas.length, 2)
  assert.equal(ENCOUNTER_DECK.length, state.encounterDeck.length)
  // 存档往返。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.locations.filter(location => Boolean(location.conspirator)).length, 9)
  assert.equal(viewState(saved, 0).campaign.opening.experience, 3)
})

test('循规蹈矩：翻开同谋 → 警察局捕获 → 胜利区 10 名异教徒 → 结局 1', () => {
  const state = makeState('by-the-book-win')
  enterScenario(state)
  const roland = state.investigators[0]
  const here = state.locations.find(location => location.id === roland.location)
  assert.ok(here.conspirator)
  // 团队线索足够后才出现「翻开同谋」行动。
  roland.clues = 5
  const flip = engine.legalMoves(state).find(row => row.rule === 'byTheBookFlipConspirator')
  assert.ok(flip, '幕 1 应提供翻开本地同谋的 [fast] 行动')
  move(state, { action: 'scenarioAction', rule: 'byTheBookFlipConspirator' })
  settle(state)
  const afterFlip = state.locations.find(location => location.id === roland.location)
  assert.equal(afterFlip.conspirator, null)
  const flipped = state.enemies.find(enemy => enemy.engagedSeat === roland.seat && enemy.conspirator)
  assert.ok(flipped)
  // 警察局捕获：花费等于剩余生命的线索，加入胜利区。
  state.investigators[0].clues = 10
  const capture = engine.legalMoves(state).find(row => row.rule === 'byTheBookCapture')
  assert.ok(capture, '警察局应提供谈判捕获行动')
  move(state, { action: 'scenarioAction', rule: 'byTheBookCapture', enemyId: capture.enemyId })
  settle(state)
  assert.equal(moduleEntry.behavior.cultistsCaptured(state), 1)
  // 补齐到 10 名（真实对局需要逐个翻面/捕获；此处用章节助手加入剩余 9 名以验证推进）。
  const behavior = moduleEntry.behavior
  for (let index = moduleEntry.behavior.cultistsCaptured(state); index < 10; index += 1) {
    const enemy = behavior.spawnScenarioEnemy(state, '01137', 'graveyard', { conspirator: true })
    behavior.addEnemyToVictory(state, enemy)
  }
  assert.equal(behavior.cultistsCaptured(state), 10)
  // 真实对局由「每次行动后 checkObjectives」推进；测试里用调试指令推进幕（同一引擎事务边界）。
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(state.campaign.records.byTheBookResolution, 'resolution1')
  assert.equal(state.campaign.records.byTheBookCultistsCaptured, 10)
  // 经验：罗兰获得胜利区敌人胜利点（10）；earnedXp = 起始经验 3 + 平行罗兰背面固定 5 + 10 = 18。
  assert.equal(state.campaign.scenarioResults[0].investigators[0].xpAwarded, 10)
  assert.equal(state.campaign.investigators[0].earnedXp, 18)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.campaign.scenarioResults[0].resolution, 'resolution1')
})

test('循规蹈矩：议程 1 推进 → Mr. Grey 入场；议程 2 推进 → 结局 2', () => {
  const state = makeState('by-the-book-lose')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  const mrGrey = state.enemies.find(enemy => enemy.code === '90033b')
  assert.ok(mrGrey, '议程 1 推进后 Mr. Grey 应入场')
  assert.equal(mrGrey.engagedSeat, state.investigators[0].seat)
  assert.equal(state.agendaIndex, 1)
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.byTheBookResolution, 'resolution2')
})

test('循规蹈矩：罗兰被击败 → 结局 2', () => {
  const state = makeState('by-the-book-defeat')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.finished, true)
})
