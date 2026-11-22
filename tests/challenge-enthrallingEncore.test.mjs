// 批次 4 · 调查员挑战：惑人返场（Enthralling Encore · 90094 / campaign enthrallingEncore）。
//
// 真实引擎验收：独立开局（萝拉·海耶斯限制 / 起始 XP 2 / 四档袋）→ 布置（剧院四地点、
// 道具牌库、小节、邪恶独奏者）→ 私密地点揭示 → 混乱标记（小节/多职介/失败选项/独奏者）
// → 幕推进（独奏者进胜利区）→ 结局 1 与记录 → 议程累计 5 个小节 → 结局 2 → 存档 + 指南。
//
// 依赖说明：萝拉·海耶斯（平行 90087）的签名卡 90088–90093 已由 core-inv 落地，因此直接使用
// 真实调查员驱动引擎流程。她的 40 张牌组需要「每个职介至少 6 张」的构筑规则，自动 buildDeck
// 尚未按该规则配平，故本文件用 lolaDeck() 构造符合规则的 40 张牌组；若 core-inv 依赖回退，
// 把 TEST_FALLBACK 改回 true 即可用测试克隆战役兜底。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/enthrallingEncore/manifest.js'
import * as encoreModule from '../content/campaigns/enthrallingEncore/scenarios/enthrallingEncore/index.js'

const scenarioEntry = encoreModule.default ?? encoreModule
const TEST_FALLBACK = false
const FALLBACK_INVESTIGATOR = '01001'

test('惑人返场注册期校验：内容包、遭遇组、结局与难度袋', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [campaign],
    scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('enthrallingEncore').id, 'enthrallingEncore')
  const manifest = registry.getScenario('enthrallingEncore')
  assert.equal(manifest.referenceCode, '90094')
  assert.deepEqual(manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  // 萝拉·海耶斯（平行 90087）必须在场；起始经验 2（side-stories.json xp）。
  assert.deepEqual(campaign.opening.investigators, ['90087'])
  assert.equal(campaign.opening.experience, 2)
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 19)
  assert.equal(campaign.chaosBags.standard.length, 19)
  assert.equal(campaign.chaosBags.hard.length, 20)
  assert.equal(campaign.chaosBags.expert.length, 21)
  // 道具牌库 15 张；私密地点与独奏者定义齐全。
  assert.equal(encoreModule.PROPS_DECK_CODES.length, 15)
  assert.equal(encoreModule.PRIVATE_LOCATION_IDS.length, 6)
  assert.equal(encoreModule.scenario.enemies['90097'].victory, 2)
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

const scenarioId = TEST_FALLBACK ? 'enthrallingEncoreTest' : 'enthrallingEncore'
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
      interludeHandlerId: 'enthrallingEncoreTestInterlude',
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
const { INVESTIGATORS, ALL_CARDS } = await import('../src/cards/cards-data.js')
const { buildAuthoredScenarioGuide } = await import('../tools/authored-scenario-guide.mjs')
const guideSource = JSON.parse(await (await import('node:fs/promises')).readFile(
  new URL('../content/scenario-guide-sources/enthrallingEncore.json', import.meta.url), 'utf8'))

const behavior = encoreModule.behavior
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
// 萝拉（平行）：40 张牌组、每个职介至少 6 张（核心/敦威治/卡尔克萨 0 级卡）。
function lolaDeck() {
  const classes = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor']
  const byClass = Object.fromEntries(classes.map(cls => [cls, []]))
  for (const card of Object.values(ALL_CARDS)) {
    if (!classes.includes(card.klass)) continue
    if (!['asset', 'event', 'skill'].includes(card.type)) continue
    if ((card.xp ?? 0) !== 0 || card.subtype) continue
    if (!/^0[123]\d{3}$/.test(card.code)) continue
    byClass[card.klass].push(card.code)
  }
  return classes.flatMap(cls => { const picks = byClass[cls].slice(0, 4); return [...picks, ...picks] })
}
function enterScenario(state) {
  const send = action => { move(state, { action }); settle(state) }
  send('hubGoSetup')
  const investigator = TEST_FALLBACK ? FALLBACK_INVESTIGATOR : campaign.opening.investigators[0]
  move(state, { action: 'hubSelectInvestigator', code: investigator })
  settle(state)
  const deck = TEST_FALLBACK ? deckbuilding.buildDeck(INVESTIGATORS[investigator]).playerCards : lolaDeck()
  move(state, { action: 'hubSetDeck', codes: deck })
  settle(state)
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(action)
}
function makeState(seed = 'enthralling-encore') {
  const state = engine.createGameState({ campaignId, campaignHub: true, difficulty: 'standard', seed }, players)
  settle(state)
  enterScenario(state)
  return state
}

test('惑人返场：布置（4 地点 / 道具牌库 / 小节 0 / 邪恶独奏者在后台）', () => {
  const state = makeState('encore-setup')
  assert.equal(state.scenario.id, scenarioId)
  assert.deepEqual(state.locations.map(location => location.id).sort(), ['backstage', 'balcony', 'lobby', 'theatre'])
  assert.equal(state.investigators[0].location, 'theatre')
  assert.equal(state.locations.find(location => location.id === 'theatre').revealed, true)
  assert.equal(state.locations.find(location => location.id === 'lobby').revealed, false)
  assert.equal(state.locations.find(location => location.id === 'backstage').revealed, false)
  // 道具牌库 15 张、小节 0、独奏者在后台。
  assert.equal(state.scenarioZones.propsDeck.length, 15)
  assert.equal(behavior.measures(state), 0)
  const soloist = state.enemies.find(enemy => enemy.code === '90097')
  assert.equal(soloist?.location, 'backstage')
  assert.equal(soloist.victory, 2)
  // 六个私密地点放在一边，尚未入场。
  assert.ok(encoreModule.PRIVATE_LOCATION_IDS.every(id => !state.locations.some(location => location.id === id)))
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.scenarioZones.propsDeck.length, 15)
  assert.equal(saved.enemies.find(enemy => enemy.code === '90097')?.location, 'backstage')
})

test('惑人返场：前厅/后台揭示 → 各放 2 张私密地点', () => {
  const state = makeState('encore-private')
  const runtime = engine.scenarioRuntime(state, [])
  runtime.reveal('lobby')
  settle(state)
  const afterLobby = state.locations.filter(location => behavior.PRIVATE_LOCATIONS.lobby.includes(location.id))
  assert.equal(afterLobby.length, 2, '前厅揭示应放 2 张前厅组私密地点')
  assert.equal(state.scenarioZones.encorePrivatePlaced.length, 2)
  // 后台揭示继续放 2 张后台组。
  const backstage = state.locations.find(location => location.id === 'backstage')
  behavior.locationRevealed(state, backstage, {}, null)
  settle(state)
  assert.equal(state.scenarioZones.encorePrivatePlaced.length, 4)
  const afterBackstage = state.locations.filter(location => behavior.PRIVATE_LOCATIONS.backstage.includes(location.id))
  assert.equal(afterBackstage.length, 2, '后台揭示应放 2 张后台组私密地点')
})

test('惑人返场：90094 混乱标记（小节 / 多职介 / 独奏者 / cultist 失败选项）', () => {
  const state = makeState('encore-tokens')
  const inv = state.investigators[0]
  state.difficulty = 'standard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull').delta, 0, '小节 0 → skull 0')
  state.scenarioZones.measures = 2
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull').delta, -2, '小节 2 → skull -2')
  state.difficulty = 'hard'
  assert.equal(behavior.resolveChaosToken(state, inv, 'skull').delta, -3, '困难档小节 2 → skull -3')
  state.difficulty = 'standard'
  const baselineClasses = behavior.classesAmongControlledCards(state, inv)
  assert.equal(behavior.resolveChaosToken(state, inv, 'tablet').delta, baselineClasses >= 3 ? -5 : -3)
  // 控制卡牌覆盖 3 个职介 → tablet -5。
  inv.assets.push({ id: 'a1', code: '01018' }) // guardian
  inv.assets.push({ id: 'a2', code: '01032' }) // seeker
  inv.assets.push({ id: 'a3', code: '01048' }) // rogue
  assert.ok(behavior.classesAmongControlledCards(state, inv) >= 3)
  assert.equal(behavior.resolveChaosToken(state, inv, 'tablet').delta, -5)
  // cultist：失败时花费 1 个线索代替伤害。
  inv.clues = 2
  const api = { choose: () => 'clue', damage: () => { throw new Error('不应受伤') }, info: () => {} }
  behavior.applyTokenEffect(state, inv, { type: 'scenarioToken', mode: 'cultist' }, api)
  assert.equal(inv.clues, 1)
  // 无线索时受伤。
  inv.clues = 0
  let damage = 0
  behavior.applyTokenEffect(state, inv, { type: 'scenarioToken', mode: 'cultist' },
    { choose: () => 'clue', damage: () => { damage += 1 }, info: () => {} })
  assert.equal(damage, 1)
  // 独奏者位于所在地点 → elderthing 再揭示标记。
  const soloist = state.enemies.find(enemy => enemy.code === '90097')
  soloist.location = inv.location
  assert.equal(behavior.resolveChaosToken(state, inv, 'elderthing').drawAnother, true)
})

test('惑人返场：独奏者进胜利区 → 幕推进 → 结局 1 与记录', () => {
  const state = makeState('encore-act')
  const soloist = state.enemies.find(enemy => enemy.code === '90097')
  state.victoryDisplay ||= []
  state.victoryDisplay.push({ id: soloist.id, code: '90097', originalCode: '90097', victory: 2 })
  assert.equal(behavior.checkObjectives(state, { advanceAct: () => { state.scenarioFlags.__advanced = true } }), true)
  assert.equal(state.scenarioFlags.__advanced, true)
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(state.campaign.records.enthrallingEncoreResolution, 'resolution1')
  assert.equal(state.campaign.records.enthrallingEncoreSignatureSwap, 'optional')
})

test('惑人返场：议程累计 5 个小节 → 结局 2', () => {
  const state = makeState('encore-agenda')
  for (let i = 0; i < 5; i++) {
    move(state, { action: 'debug', kind: 'advanceAgenda' })
    settle(state, choice => choice.options.find(option => option.id === 'skip')?.id)
  }
  assert.equal(behavior.measures(state), 5)
  assert.equal(state.campaign.finished, true)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.enthrallingEncoreResolution, 'resolution2')
  assert.equal(state.campaign.records.enthrallingEncoreMeasures, 5)
})

test('惑人返场：指南加载（中英结构一致、结局齐全）', () => {
  const guide = buildAuthoredScenarioGuide({ id: 'enthrallingEncore', campaignId: 'enthrallingEncore',
    resolutionIds: scenarioEntry.manifest.resolutionIds }, guideSource)
  assert.equal(guide.sourceKind, 'authored')
  for (const section of ['intro', 'setup', 'resolutions']) assert.ok(Array.isArray(guide.locales.en[section]))
  assert.ok(guide.locales.en.specialRules.length > 0)
  assert.equal(guide.locales.zh.resolutions.length, guide.locales.en.resolutions.length)
  assert.ok(!/[A-Za-z]{4,}/.test(guide.locales.zh.setup[0].children[0].text), '中文指南不得留英文占位')
  for (const id of scenarioEntry.manifest.resolutionIds) {
    assert.ok(guide.locales.en.resolutions.some(block => block.id === id), `缺少结局 ${id}`)
  }
})
