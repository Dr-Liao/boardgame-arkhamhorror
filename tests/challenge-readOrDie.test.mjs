// 批次 2 · 调查员挑战：读书至死（Read or Die · 90004 / campaign readOrDie）。
//
// 真实引擎验收：独立开局（调查员限制 / 起始 XP / 难度袋）→ 布置（8 地点、书卷暗置、
// 故事资产、死书之灵）→ 幕 1 谈判推进 → 结局 1 与记录/经验 → 存档 JSON 往返；
// 另验议程推进 → 结局 2，以及全员被击败 → noResolution 按结局 2 结算。
//
// 本文件在 import 引擎之前先把挑战内容注册进内容注册表：src/engine/card-lookup.js
// 在模块加载时从 contentRegistry 合并遭遇定义，晚注册的剧本拿不到本关敌人定义。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/readOrDie/manifest.js'
import * as readOrDieModule from '../content/campaigns/readOrDie/scenarios/readOrDie/index.js'

const scenarioEntry = readOrDieModule.default ?? readOrDieModule

// 注册期 fail-closed：缺包 / 未知遭遇组 / 缺地点身份都必须抛错。
test('读书至死注册期校验：内容包、遭遇组与剧本身份', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [campaign],
    scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('readOrDie').id, 'readOrDie')
  const manifestScenario = registry.getScenario('readOrDie')
  assert.equal(manifestScenario.referenceCode, '90004')
  assert.deepEqual(manifestScenario.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])

  // 批次 2 Lead 裁决：挑战独立难度四档（side-stories.json difficultyLevels）。
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 17)
  assert.equal(campaign.chaosBags.standard.length, 17)
  assert.equal(campaign.chaosBags.hard.length, 17)
  assert.equal(campaign.chaosBags.expert.length, 16)
  assert.throws(() => createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [{ ...campaign, requiredPackIds: ['core', 'missingPack'] }],
    scenarios: [scenarioEntry],
  }), /缺少卡包/)
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

// 牌组里 4 张非弱点书卷（全部 0 级、调查员可构筑）；其余沿用自动牌组骨架。
const DECK_TOMES = ['01031', '01035', '03025', '05116']
const ASSET_TOMES = ['01031', '01035', '03025', '05116', '05316', '06112', '07022', '08033']
function deckCodes() {
  const codes = [...deckbuilding.buildDeck(INVESTIGATORS['90001']).playerCards]
  for (const [index, code] of DECK_TOMES.entries()) codes[index] = code
  return codes
}

function enterScenario(state) {
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '90001' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
}

function makeState(seed = 'read-or-die') {
  const state = engine.createGameState({ campaignId: 'readOrDie', campaignHub: true, difficulty: 'hard', seed }, players)
  settle(state)
  return state
}

test('读书至死：独立开局限制、起始 XP 与布置', () => {
  // 调查员限制：非法选人拒绝、2P 席位不足（本批只交付 1P 单开）。
  assert.throws(() => engine.createGameState({ campaignId: 'readOrDie', playerInvestigator: '01001' }, players), /不能使用/)
  assert.throws(() => engine.createGameState({ campaignId: 'readOrDie' }, [...players, { seat: 1 }]), /不足/)
  const state = makeState()
  // 初始 XP：manifest 声明 3（= side-stories.json xp 字段），独立开局读点同一值。
  assert.equal(state.campaign.opening.experience, 3)
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  send(state, 'hubGoSetup')
  assert.deepEqual(engine.legalMoves(state).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code), ['90001'])
  assert.ok(engine.validateMove(state, 0, { action: 'hubSelectInvestigator', code: '01001' }))
  move(state, { action: 'hubSelectInvestigator', code: '90001' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  assert.equal(state.campaign.investigators[0].xp, 3)
  assert.equal(state.campaign.investigators[0].spentXp, 0)
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
  // 难度与混乱袋：独立开局只提供 standard/hard，这里选 hard（17 枚）。
  assert.equal(state.difficulty, 'hard')
  assert.equal(state.chaosBag.length, 17)
  assert.ok(state.chaosBag.includes('skull') && state.chaosBag.includes('elderthing'))
  // 布置：8 处地点全部入场；黛西在奥恩图书馆。
  assert.equal(state.locations.length, 8)
  assert.equal(state.investigators[0].location, 'orneLibrary')
  assert.equal(state.locations.find(location => location.id === 'orneLibrary').revealed, true)
  assert.equal(state.locations.find(location => location.id === 'miskatonicQuad').revealed, true)
  // 遭遇牌库：32 张（90007 死书之灵放在奥恩图书馆，不进牌库）。
  assert.equal(state.encounterDeck.length, 32)
  // 死书之灵在奥恩图书馆、横置；Jazz 在科学大楼；阿米蒂奇由黛西控制。
  const namer = state.enemies.find(enemy => enemy.code === '90007')
  assert.ok(namer)
  assert.equal(namer.location, 'orneLibrary')
  assert.equal(namer.exhausted, true)
  const jazz = (state.storyAssets || []).find(asset => asset.code === '02060')
  assert.equal(jazz?.location, 'scienceBuilding')
  assert.ok(state.investigators[0].assets.some(asset => asset.code === '02040'))
  // 书卷暗置：牌组里所有非弱点书卷（≥4）被移出并压在地点下方。
  const beneath = state.locations.flatMap(location => location.beneath || [])
  assert.ok(beneath.length >= 4)
  for (const code of DECK_TOMES) assert.ok(beneath.includes(code), `beneath 缺少 ${code}`)
  // 存档 JSON 往返：布置与战役记录保持。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.locations.length, 8)
  assert.equal(saved.encounterDeck.length, 32)
  assert.equal(viewState(saved, 0).campaign.opening.experience, 3)
})

test('读书至死：幕 1 谈判放逐死书之灵 → 结局 1 与经验/记录', () => {
  const state = makeState('read-or-die-win')
  enterScenario(state)
  const daisy = state.investigators[0]
  assert.equal(daisy.code, '90001')
  // 真实流程通过幕 1 [fast] 行动逐张取回书卷；这里直接放入场，凑齐谈判所需的 4+ 张书卷。
  const runtime = engine.scenarioRuntime(state, [])
  for (const code of ASSET_TOMES) runtime.giveAsset(daisy.seat, code)
  const isTomeAsset = asset => ASSET_TOMES.includes(asset.code)
  assert.ok(daisy.assets.filter(isTomeAsset).length >= 4)
  // 固定混乱袋为 0，确保谈判检定成功（黛西每张书卷 +1 意志，难度随书卷 -2）。
  state.chaosBag = ['0']
  const parley = engine.legalMoves(state).find(row => row.rule === 'readOrDieParley')
  assert.ok(parley, '菜单里应有与死书之灵谈判的行动')
  move(state, { action: 'scenarioAction', rule: 'readOrDieParley' })
  settle(state)
  assert.equal(state.uiState, 'campaignResult')
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.scenarioResults.length, 1)
  const result = state.campaign.scenarioResults[0]
  assert.equal(result.scenarioId, 'readOrDie')
  assert.equal(result.resolution, 'resolution1')
  // 记录：结局 id 与游戏结束时场上书卷数量（按场上实际书卷资产结算）。
  assert.equal(state.campaign.records.readOrDieResolution, 'resolution1')
  const tomesAtEnd = daisy.assets.filter(isTomeAsset).length
  assert.equal(state.campaign.records.readOrDieTomesInPlay, tomesAtEnd)
  // 经验：黛西按「胜利点或书卷数取高」= 书卷数（胜利区为空）；earnedXp 含起始构筑经验 3。
  assert.equal(state.campaign.investigators[0].earnedXp, 3 + tomesAtEnd)
  // 结局后存档往返。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(viewState(saved, 0).campaign.opening.experience, 3)
})

test('读书至死：议程推进 → 结局 2', () => {
  const state = makeState('read-or-die-lose')
  enterScenario(state)
  assert.equal(state.campaign.scenarioResults.length, 0)
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.readOrDieResolution, 'resolution2')
})

test('读书至死：全员被击败 → noResolution 按结局 2 结算', () => {
  const state = makeState('read-or-die-defeat')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'noResolution')
  // 参考：noResolution（全员被击败）按结局 2 结算。
  assert.equal(state.campaign.records.readOrDieResolution, 'resolution2')
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.result, 'defeat')
})
