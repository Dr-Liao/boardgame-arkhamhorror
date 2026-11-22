// 批次 4 · 调查员挑战：安魂镇息（Laid to Rest · 90054 / campaign laidToRest）。
//
// 真实引擎验收：独立开局（调查员限制 / 起始 XP / 难度袋）→ 布置（7 地点、双遭遇牌库、
// 灵魂牌库、异端者、饥饿之魂暗置、让·德弗罗）→ 地点翻幽灵面 + 幽灵遭遇牌库 → 混乱标记数值
// → 幕推进 → 结局 1 与记录 → 议程恐惧累计 → 结局 2 → 存档 JSON 往返 + 指南加载。
//
// 依赖说明：吉姆·卡尔弗（平行 90049）的签名卡 90052 / 灵魂牌库由 core-inv 工作流实现；
// 该依赖未落地前，引擎无法构筑 90049 的牌组（deckbuilding 报「签名卡依赖缺失」）。因此本文件：
//   · 第 1 例用真实 manifest 做注册期验收（requiredPackIds / 遭遇组 / 难度袋 / 调查员限制）；
//   · 90049 的签名卡 90052 现已由 core-inv 落地，故其余用例直接使用真实调查员 90049 驱动
//     真实引擎流程；若该依赖回退，把 TEST_FALLBACK 改回 true 即可用测试克隆战役兜底。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/laidToRest/manifest.js'
import * as laidToRestModule from '../content/campaigns/laidToRest/scenarios/laidToRest/index.js'

const scenarioEntry = laidToRestModule.default ?? laidToRestModule
const TEST_FALLBACK = false
const FALLBACK_INVESTIGATOR = '01001'

test('安魂镇息注册期校验：内容包、遭遇组、结局与难度袋', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [campaign],
    scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('laidToRest').id, 'laidToRest')
  const manifest = registry.getScenario('laidToRest')
  assert.equal(manifest.referenceCode, '90054')
  assert.deepEqual(manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  // 调查员限制：平行吉姆·卡尔弗；起始经验 3（side-stories.json xp）。
  assert.deepEqual(campaign.opening.investigators, ['90049'])
  assert.equal(campaign.opening.experience, 3)
  // 四档独立难度袋（Haskell easy/standard/hard/expert 逐字）。
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 18)
  assert.equal(campaign.chaosBags.standard.length, 18)
  assert.equal(campaign.chaosBags.hard.length, 18)
  assert.equal(campaign.chaosBags.expert.length, 17)
  // 双遭遇牌库：基础牌库进 manifest；幽灵牌库是运行期第二牌堆，不进 zones。
  assert.ok(manifest.zones.encounterDeck.length > 0)
  assert.ok(laidToRestModule.SPECTRAL_DECK_CODES.length > 0)
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

// 测试克隆战役：同一章节数据，换掉必需调查员以便在 core-inv 依赖落地前驱动真实引擎流程。
const scenarioId = TEST_FALLBACK ? 'laidToRestTest' : 'laidToRest'
const campaignId = scenarioId
const clonedScenario = TEST_FALLBACK
  ? {
      ...scenarioEntry,
      scenario: { ...scenarioEntry.scenario, id: scenarioId },
      behavior: { ...scenarioEntry.behavior, id: scenarioId },
      manifest: { ...scenarioEntry.manifest, id: scenarioId, campaignId, behaviorIds: [scenarioId] },
    }
  : scenarioEntry
const clonedCampaign = TEST_FALLBACK
  ? {
      ...campaign,
      id: campaignId,
      opening: { ...campaign.opening, investigators: [FALLBACK_INVESTIGATOR] },
      scenarioIds: [scenarioId],
      unlock: { [scenarioId]: [] },
      interludeHandlerId: 'laidToRestTestInterlude',
      flow: { start: scenarioId, nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' },
      } },
    }
  : campaign
if (!contentRegistry.getCampaign(campaign.id)) registerContentBundle({ campaigns: [campaign], scenarios: [scenarioEntry] })
if (TEST_FALLBACK && !contentRegistry.getCampaign(campaignId)) {
  registerContentBundle({ campaigns: [clonedCampaign], scenarios: [clonedScenario] })
}

const engine = await import('../src/engine/engine.js')
const deckbuilding = await import('../src/deck/deckbuilding.js')
const { migrateState } = await import('../src/engine/save-migration.js')
const { viewState } = await import('../src/integration/observation.js')
const { INVESTIGATORS } = await import('../src/cards/cards-data.js')
const { buildAuthoredScenarioGuide } = await import('../tools/authored-scenario-guide.mjs')
const guideSource = JSON.parse(await (await import('node:fs/promises')).readFile(
  new URL('../content/scenario-guide-sources/laidToRest.json', import.meta.url), 'utf8'))

const behavior = laidToRestModule.behavior
const players = [{ seat: 0, role: 'human' }]

function move(state, command) {
  const seat = engine.decisionSeat(state)
  assert.equal(engine.validateMove(state, seat, command), null, JSON.stringify(command))
  return engine.applyMove(state, seat, command)
}
function settle(state, select = () => null) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 300, `Choice loop: ${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(candidate =>
      choice.options.some(option => option.id === candidate)) ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    move(state, { action: 'choose', choiceId: choice.id, optionId: id })
  }
}
function enterScenario(state) {
  const send = action => { move(state, { action }); settle(state) }
  send('hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: TEST_FALLBACK ? FALLBACK_INVESTIGATOR : campaign.opening.investigators[0] })
  settle(state)
  const deck = deckbuilding.buildDeck(INVESTIGATORS[TEST_FALLBACK ? FALLBACK_INVESTIGATOR : campaign.opening.investigators[0]]).playerCards
  move(state, { action: 'hubSetDeck', codes: deck })
  settle(state)
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(action)
}
function makeState(seed = 'laid-to-rest') {
  const state = engine.createGameState({ campaignId, campaignHub: true, difficulty: 'hard', seed }, players)
  settle(state)
  enterScenario(state)
  return state
}

test('安魂镇息：布置（7 地点 / 双遭遇牌库 / 灵魂牌库 / 让·德弗罗 / 饥饿之魂暗置）', () => {
  const state = makeState('laid-to-rest-setup')
  assert.equal(state.scenario.id, scenarioId)
  assert.equal(state.locations.length, 7)
  assert.equal(state.investigators[0].location, 'hangmansBrook')
  assert.ok(state.locations.every(location => location.revealed === true))
  // 每个地点至少 1×人数线索。
  assert.ok(state.locations.every(location => (location.clues || 0) >= 1))
  // 幽灵遭遇牌库（第二牌堆）与基础遭遇牌库分离。
  assert.ok((state.extraEncounterDecks?.spectral?.deck?.length || 0) > 0)
  assert.ok((state.encounterDeck?.length || 0) > 0)
  // 灵魂牌库 = 9 张盟友 + 4 张异端者；2 张异端者移出游戏。
  assert.equal(state.scenarioZones.spiritDeck.length, 13)
  assert.equal(state.scenarioFlags.hereticsInDeck.length, 4)
  assert.equal(state.scenarioFlags.removedHeretics.length, 2)
  // 让·德弗罗在绞刑者河；饥饿之魂暗置在 4 个地点下方。
  const jean = state.enemies.find(enemy => enemy.code === '90057a')
  assert.equal(jean?.location, 'hangmansBrook')
  const picks = state.scenarioFlags.laidToRestLocations
  assert.equal(picks.length, 7)
  assert.deepEqual(Object.keys(state.scenarioFlags.ravenousUnder).sort(), [
    picks.find(id => id.startsWith('theGallows')), picks.find(id => id.startsWith('hereticsGraves')),
    'chapelAttic176', picks.find(id => id.startsWith('chapelCrypt')),
  ].sort())
  // 存档往返保持布置。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.locations.length, 7)
  assert.equal(saved.scenarioZones.spiritDeck.length, 13)
  assert.equal(viewState(saved, 0).scenario?.id ?? saved.scenario.id, scenarioId)
})

test('安魂镇息：地点翻到幽灵面 → 幽灵遭遇牌库 + 饥饿之魂显形', () => {
  const state = makeState('laid-to-rest-flip')
  const gallows = state.locations.find(location => location.id.startsWith('theGallows'))
  assert.ok(gallows)
  assert.equal(gallows.code, gallows.originalCode)
  const runtime = engine.scenarioRuntime(state, [])
  runtime.flipLocation(gallows.id)
  settle(state)
  const flipped = state.locations.find(location => location.id === gallows.id)
  assert.ok((flipped.traits || []).includes('Spectral'), '地点应翻到 Spectral 面')
  assert.equal(behavior.encounterDeckFor(state, { location: gallows.id }), 'spectral')
  const ravenous = state.enemies.filter(enemy => enemy.code === '90058')
  assert.equal(ravenous.length, 1, '翻面应使暗置的饥饿之魂显形')
  assert.equal(Object.keys(state.scenarioFlags.ravenousUnder).length, 3, '该地点下方不再有暗置的饥饿之魂')
  assert.ok(ravenous.some(enemy => enemy.location === gallows.id))
})

test('安魂镇息：90054 混乱标记数值（skull/cultist/tablet/elderthing）', () => {
  const state = makeState('laid-to-rest-tokens')
  state.difficulty = 'standard'
  const inv = state.investigators[0]
  const spectral = state.locations.filter(location => (location.traits || []).includes('Spectral')).length
  const attached = (state.scenarioZones.beyondAttached || []).length
  const baseSkull = behavior.resolveChaosToken(state, inv, 'skull')
  assert.equal(baseSkull.delta, -1, '标准难度 skull = -(未了之事 0 + 1)')
  assert.equal(behavior.resolveChaosToken(state, inv, 'tablet').delta, -spectral)
  assert.equal(behavior.resolveChaosToken(state, inv, 'cultist').delta, -attached)
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing').delta, -2)
  // 往胜利区放未了之事后 skull 变强。
  state.victoryDisplay.push({ id: 'v1', code: '05178b', originalCode: '05178b' })
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull').delta, -2)
  assert.equal(behavior.banishedUnfinishedBusiness(state), 1)
  // 困难档：skull = -(未了之事 + 2)。
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull').delta, -3)
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing').delta, -3)
})

test('安魂镇息：幕推进 → 结局 1 与记录', () => {
  const state = makeState('laid-to-rest-act')
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.scenarioResults.length, 1)
  const result = state.campaign.scenarioResults[0]
  assert.equal(result.scenarioId, scenarioId)
  assert.equal(result.resolution, 'resolution1')
  assert.equal(state.campaign.records.laidToRestResolution, 'resolution1')
  assert.equal(typeof state.campaign.records.laidToRestSpiritDeckRemaining, 'number')
})

test('安魂镇息：议程恐惧累计 4 次 → 结局 2', () => {
  const state = makeState('laid-to-rest-agenda')
  for (let i = 0; i < 4; i++) {
    move(state, { action: 'debug', kind: 'advanceAgenda' })
    settle(state)
  }
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.laidToRestResolution, 'resolution2')
  assert.equal(state.scenarioFlags.agendaHorror, 4)
})

test('安魂镇息：指南加载（中英结构一致、结局齐全）', () => {
  const guide = buildAuthoredScenarioGuide({ id: 'laidToRest', campaignId: 'laidToRest',
    resolutionIds: scenarioEntry.manifest.resolutionIds }, guideSource)
  assert.equal(guide.sourceKind, 'authored')
  for (const section of ['intro', 'setup', 'resolutions']) assert.ok(Array.isArray(guide.locales.en[section]))
  assert.ok(guide.locales.en.specialRules.length > 0)
  assert.equal(guide.locales.zh.resolutions.length, guide.locales.en.resolutions.length)
  assert.ok(guide.locales.zh.intro[0].children[0].text.length > 20)
  assert.ok(!/[A-Za-z]{4,}/.test(guide.locales.zh.setup[0].children[0].text), '中文指南不得留英文占位')
  for (const id of scenarioEntry.manifest.resolutionIds) {
    assert.ok(guide.locales.en.resolutions.some(block => block.id === id), `缺少结局 ${id}`)
  }
})
