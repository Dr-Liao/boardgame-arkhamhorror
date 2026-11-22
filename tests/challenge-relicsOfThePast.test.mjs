// 批次 4 · 调查员挑战：往昔遗物（Relics of the Past · 90065 / campaign relicsOfThePast）。
//
// 真实引擎验收：独立开局（蒙特雷限制 / 起始 XP / 四档难度袋）→ 布置（遗迹入口、探索牌库、
// 内部密室/古代遗物/伊格之子放一边、补给品）→ 探索 → 幕推进 → 结局 1 与记录；
// 另验议程 1 生成坑洞居住者、议程 2 → 结局 2、古代遗物从探索牌库抽到即受控、存档 JSON 往返。
//
// 本文件在 import 引擎之前先把挑战内容注册进内容注册表：src/engine/card-lookup.js
// 在模块加载时从 contentRegistry 合并遭遇定义，晚注册的剧本拿不到本关敌人定义。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/relicsOfThePast/manifest.js'
import * as moduleEntry from '../content/campaigns/relicsOfThePast/scenarios/relicsOfThePast/index.js'

const scenarioEntry = moduleEntry.default ?? moduleEntry
const {
  ENCOUNTER_DECK, RELIC_CODES, VENGEANT_PAST_CODE, DWELLER_CODE, behavior, initialExplorationDeck,
} = moduleEntry

test('往昔遗物注册期校验：内容包、遭遇组与剧本身份', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('relicsOfThePast').id, 'relicsOfThePast')
  const manifestScenario = registry.getScenario('relicsOfThePast')
  assert.equal(manifestScenario.referenceCode, '90065')
  assert.deepEqual(manifestScenario.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  // 复用 The Doom of Eztli 的剧本参考/幕/议程与三处地点必须移除。
  const removed = manifestScenario.zones.removed.map(entry => entry.cardCode)
  for (const code of ['04054', '04057', '04058', '04059', '04061', '04063']) assert.ok(removed.includes(code), `removed 缺少 ${code}`)
  // 四档难度袋（RelicsOfThePast.hs：easy/standard/hard 16，expert 17）。
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 16)
  assert.equal(campaign.chaosBags.standard.length, 16)
  assert.equal(campaign.chaosBags.hard.length, 16)
  assert.equal(campaign.chaosBags.expert.length, 17)
  // 探索牌库组成：标准 10 张 / 困难 12 张（+Locked Door、Entombed）。
  assert.equal(initialExplorationDeck('standard').length, 10)
  assert.equal(initialExplorationDeck('hard').length, 12)
  assert.throws(() => createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [{ ...campaign, requiredPackIds: ['core', 'missingPack'] }],
    scenarios: [scenarioEntry],
  }), /缺少卡包/)
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
  return [...deckbuilding.buildDeck(INVESTIGATORS['90062']).playerCards]
}
function enterScenario(state) {
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '90062' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
}
function makeState(seed = 'relics-of-the-past', difficulty = 'standard') {
  const state = engine.createGameState({ campaignId: 'relicsOfThePast', campaignHub: true, difficulty, seed }, players)
  settle(state)
  return state
}

test('往昔遗物：独立开局限制、起始 XP、布置与探索牌库', () => {
  assert.throws(() => engine.createGameState({ campaignId: 'relicsOfThePast', playerInvestigator: '01001' }, players), /不能使用|要求包含指定调查员/)
  assert.throws(() => engine.createGameState({ campaignId: 'relicsOfThePast' }, [...players, { seat: 1 }]), /不足|要求包含指定调查员/)
  const state = makeState('relics-of-the-past-setup')
  assert.equal(state.campaign.opening.experience, 3)
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  send(state, 'hubGoSetup')
  // 批次 4：指定调查员必须在场，其余席位任意。
  const investigatorOptions = engine.legalMoves(state).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code)
  assert.ok(investigatorOptions.includes('90062'), '必须包含指定调查员蒙特雷')
  assert.ok(investigatorOptions.length > 1, '其余调查员可选')
  move(state, { action: 'hubSelectInvestigator', code: '90062' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.difficulty, 'standard')
  assert.equal(state.chaosBag.length, 16)
  // 布置：只有遗迹入口入场；探索牌库 10 张；内部密室/古代遗物/伊格之子在一边。
  assert.deepEqual(state.locations.map(location => location.id), ['entryway'])
  assert.equal(state.investigators[0].location, 'entryway')
  assert.equal(state.explorationDeck.length, 10)
  assert.equal(state.locations.some(location => location.id === 'innerChamber'), false)
  assert.equal((state.storyAssets || []).filter(asset => RELIC_CODES.includes(asset.code)).length, 0)
  const aside = state.scenarioZones?.setAside || []
  for (const code of [...RELIC_CODES, VENGEANT_PAST_CODE, '04083']) assert.ok(aside.includes(code), `setAside 缺少 ${code}`)
  assert.ok(aside.includes('90071'))
  // 补给品：1P 默认指南针 + 探险日志。
  assert.deepEqual(state.scenarioFlags.supplies['0'], ['compass', 'journal'])
  // 议程毁灭阈值 = 印刷值 + 调查员人数。
  assert.equal(state.agendas[state.agendaIndex].code, '90066a')
  assert.equal(state.agendas[state.agendaIndex].doomThreshold, 9)
  assert.equal(state.encounterDeck.length, ENCOUNTER_DECK.length)
  // 存档 JSON 往返。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.explorationDeck.length, 10)
  assert.deepEqual(saved.scenarioFlags.supplies['0'], ['compass', 'journal'])
  assert.equal(viewState(saved, 0).campaign.opening.experience, 3)
})

test('往昔遗物：无线索才能探索，探索牌库减少且符号连接成立', () => {
  const state = makeState('relics-of-the-past-explore')
  enterScenario(state)
  // 遗迹入口初始有 1 个线索：探索按钮不可用。
  assert.equal(engine.legalMoves(state).some(row => row.action === 'explore'), false)
  state.locations.find(location => location.id === 'entryway').clues = 0
  assert.ok(engine.legalMoves(state).some(row => row.action === 'explore'), '清空线索后应可探索')
  let placed = 0
  for (let index = 0; index < 12 && placed === 0; index += 1) {
    if (!engine.legalMoves(state).some(row => row.action === 'explore')) break
    move(state, { action: 'explore' })
    settle(state)
    if (state.locations.length > 1) placed = state.locations.length - 1
  }
  assert.ok(state.explorationDeck.length < 10, '探索后探索牌库应减少')
  assert.ok(placed >= 1, '多次探索后应至少放下一处地点')
  const entry = state.locations.find(location => location.id === 'entryway')
  const next = state.locations.find(location => location.id !== 'entryway')
  assert.ok(entry.connections.includes(next.id) || next.connections.includes(entry.id), '新地点应与入口相连')
  // beyond: 探索后调查员移动到新地点。
  assert.equal(state.investigators[0].location, next.id)
})

test('往昔遗物：幕 1 → 幕 2 → 结局 1 与古代遗物入探索牌库', () => {
  const state = makeState('relics-of-the-past-win')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  assert.equal(state.actIndex, 1)
  assert.equal(state.acts[state.actIndex].code, '90069')
  // 幕 1 背面：古代遗物、复仇往昔、单面地点被洗回探索牌库（数量增加）。
  assert.ok(state.explorationDeck.includes(VENGEANT_PAST_CODE), '复仇往昔应被洗入探索牌库')
  assert.ok(RELIC_CODES.some(code => state.explorationDeck.includes(code)), '古代遗物应被洗入探索牌库')
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(state.campaign.records.relicsOfThePastResolution, 'resolution1')
  assert.ok(state.campaign.records.relicsOfThePastRelics >= 0)
  assert.ok(state.campaign.investigators[0].earnedXp >= 3)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.campaign.scenarioResults[0].resolution, 'resolution1')
})

test('往昔遗物：古代遗物从探索牌库抽到即受控（显现）', () => {
  const state = makeState('relics-of-the-past-relic')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  // 固定探索牌库顶为一张古代遗物（引擎探索会把非地点卡按遭遇结算）。
  state.locations.find(location => location.id === 'entryway').clues = 0
  state.explorationDeck.push('90073')
  for (let index = 0; index < 8; index += 1) {
    if ((state.storyAssets || []).some(asset => RELIC_CODES.includes(asset.code) && asset.controllerSeat === 0)) break
    if (!engine.legalMoves(state).some(row => row.action === 'explore')) {
      const here = state.locations.find(location => location.id === state.investigators[0].location)
      if (here) here.clues = 0
    }
    if (!engine.legalMoves(state).some(row => row.action === 'explore')) break
    move(state, { action: 'explore' })
    settle(state, choice => (choice.options.some(option => option.id === 'doom') ? 'doom' : null))
  }
  const relic = (state.storyAssets || []).find(asset => RELIC_CODES.includes(asset.code))
  assert.ok(relic, '古代遗物应进入场并受蒙特雷控制')
  assert.equal(relic.controllerSeat, 0)
})

test('往昔遗物：议程 1 生成坑洞居住者 → 议程 2 结局 2', () => {
  const state = makeState('relics-of-the-past-lose')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.agendaIndex, 1)
  assert.equal(state.agendas[state.agendaIndex].code, '90067')
  const dweller = state.enemies.find(enemy => enemy.code === DWELLER_CODE)
  assert.ok(dweller, '议程 1 背面应生成坑洞居住者')
  assert.equal(dweller.engagedSeat, 0)
  // 再推进议程 2：全体被击败 + 肉体创伤 + 结局 2。
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.relicsOfThePastResolution, 'resolution2')
  assert.equal((state.campaign.trauma?.[0]?.physical || 0) >= 1, true)
})

test('往昔遗物：混乱标记与搜索/中毒/复仇读点', () => {
  const hard = behavior.tokenMeanings({ difficulty: 'hard' })
  const standard = behavior.tokenMeanings({ difficulty: 'standard' })
  assert.equal(standard.tablet.delta, -3)
  assert.equal(hard.tablet.delta, -4)
  assert.equal(standard.elderthing.delta, -3)
  assert.equal(hard.elderthing.delta, -5)
  const state = { difficulty: 'standard', investigators: [], enemies: [] }
  assert.equal(behavior.resolveChaosToken(state, null, 'cultist').delta, -1)
  const poisoned = { difficulty: 'standard', investigators: [{ seat: 0, poisoned: true }], enemies: [] }
  assert.equal(behavior.resolveChaosToken(poisoned, poisoned.investigators[0], 'cultist').delta, -2)
})
