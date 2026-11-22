// 批次 4 · Beta 支线 Machinations Through Time（87001）专项测试。
// 覆盖：注册/配置、开局布置、幕推进→结局、混乱标记、存档往返、玩家卡/奖励写回、指南源结构。
// 跨桌/多时代同步由 Lead 引擎提供，本批验证单桌普通流程。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createGameState, applyMove, validateMove } from '../src/engine/engine.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import * as campaign from '../content/campaigns/machinationsThroughTime/manifest.js'
import * as chapter from '../content/campaigns/machinationsThroughTime/scenarios/machinationsThroughTime/index.js'
import {
  AGENDA_CODES, ACT_CODES, ENCOUNTER_DECK, ERAS, LOCATIONS, MACHINATION_CODES, PLOT_CODES,
  STORY_CARDS, TOKEN_MEANINGS, SET_ASIDE_ALIASES,
} from '../content/campaigns/machinationsThroughTime/scenarios/machinationsThroughTime/definition.js'
import { behavior } from '../content/campaigns/machinationsThroughTime/scenarios/machinationsThroughTime/behavior.js'

const CAMPAIGN_ID = 'machinationsThroughTime'
const SCENARIO_ID = 'machinationsThroughTime'
// 生产组合根已注册本战役；只在未注册时补注册，避免重复 ID。
if (!contentRegistry.getCampaign(CAMPAIGN_ID)) {
  registerContentBundle({
    campaigns: [campaign.manifest],
    scenarios: [{
      scenario: chapter.scenario,
      identities: chapter.identities,
      behavior: chapter.behavior,
      manifest: chapter.manifest,
    }],
  })
}

function settle(state, chooser = () => null, limit = 200) {
  for (let count = 0; state.pendingChoice; count += 1) {
    assert.ok(count < limit, `选择循环未收敛：${state.pendingChoice?.prompt || ''}`)
    const pending = state.pendingChoice
    const optionId = chooser(pending, state)
      ?? pending.options.find(option => ['done', 'skip', 'finish'].includes(option.id))?.id
      ?? pending.options[0].id
    const seat = pending.seat ?? state.currentSeat
    const move = { action: 'choose', choiceId: pending.id, optionId }
    assert.equal(validateMove(state, seat, move), null, `非法选择 ${optionId}`)
    applyMove(state, seat, move)
  }
  return state
}

function startScenario(settings = {}, players = 1) {
  const state = createGameState(
    { campaignId: CAMPAIGN_ID, seed: settings.seed || 'mtt-test', playerInvestigator: '01001', difficulty: settings.difficulty || 'standard' },
    Array.from({ length: players }, (_, seat) => ({ seat })),
  )
  settle(state)
  return state
}

function checkObjectiveState(overrides = {}) {
  return {
    pendingChoice: null, difficulty: 'standard', numInvestigators: 1, agendaIndex: 0,
    agendas: [{ originalCode: '87002' }, { originalCode: '87003' }],
    investigators: [{ seat: 0, defeated: false, resigned: false, insane: false }],
    enemies: [], campaign: { records: {} },
    scenarioFlags: { plotCode: '87038', machinationCode: '87033' },
    scenarioZones: {
      machinationCode: '87033', plotCode: '87038',
      storyCards: [
        { code: '87006', role: 'nobleLegacy', inPlay: true, inVictory: false },
        { code: '87015', role: 'nobleLegacy', inPlay: true, inVictory: false },
        { code: '87024', role: 'nobleLegacy', inPlay: true, inVictory: false },
        { code: '87038', role: 'plot', inPlay: true, inVictory: false },
      ],
      assets: { '87014': { code: '87014', location: 'riverDocksPast' } },
      ...overrides.scenarioZones,
    },
    campaignRecords: undefined,
    ...overrides,
  }
}

const NOBLE_KEYS = [
  'thomasAndMaryHaveMet', 'thomasAndMaryAreInspiredByNikolaTesla', 'fundingForAnObservatoryHasBegun',
  'theObservatoryIsBuilt', 'teleportationResearchHasBegun', 'corriganIndustriesHasBeenFounded',
  'thomasAndMaryHaveMadeAHistoricDiscovery', 'thomasAndMaryHaveWonANobelPrize',
]

test('Machinations：注册与配置（campaign/scenario/pack/命运袋/结局）', () => {
  assert.equal(campaign.manifest.id, CAMPAIGN_ID)
  assert.deepEqual([...campaign.manifest.requiredPackIds], ['core', 'mttCampaign'])
  assert.equal(campaign.manifest.opening.experience, 2)
  assert.deepEqual([...campaign.manifest.scenarioIds], [SCENARIO_ID])
  assert.equal(campaign.manifest.epicMultiplayer.enabled, true)
  assert.equal(campaign.manifest.epicMultiplayer.tables, 3)
  assert.deepEqual([...campaign.manifest.epicMultiplayer.eraTables], ['past', 'present', 'future'])
  assert.equal(campaign.manifest.chaosBags.easy.length, 18)
  assert.equal(campaign.manifest.chaosBags.standard.length, 17)
  assert.equal(campaign.manifest.chaosBags.hard.length, 17)
  assert.equal(campaign.manifest.chaosBags.expert.length, 17)
  assert.deepEqual([...campaign.manifest.resolutionIds], ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  // 手册注册的 requiredEncounterGroupIds
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds], ['machinationsThroughTime'])
  assert.equal(chapter.manifest.campaignId, CAMPAIGN_ID)
  assert.deepEqual([...ACT_CODES], ['87004'])
  assert.deepEqual([...AGENDA_CODES], ['87002', '87003'])
  assert.deepEqual([...ERAS], ['past', 'present', 'future'])
})

test('Machinations：三时代地点/剧情卡/遭遇牌库数据', () => {
  assert.equal(Object.keys(LOCATIONS).length, 16)
  assert.equal(LOCATIONS.tindalos.era, 'all')
  assert.equal(ENCOUNTER_DECK.length, 33, '剩余 33 张遭遇卡')
  assert.deepEqual(MACHINATION_CODES, ['87033', '87034', '87035'])
  assert.deepEqual(PLOT_CODES, ['87038', '87039', '87042'])
  assert.equal(Object.values(STORY_CARDS).filter(story => story.role === 'nobleLegacy').length, 3)
  assert.equal(Object.values(STORY_CARDS).filter(story => story.role === 'plot').length, 3)
  assert.ok(SET_ASIDE_ALIASES.includes('87036a'), '艾德温敌人放在一边')
  // 连接对称且都在三时代内
  for (const [id, location] of Object.entries(LOCATIONS)) {
    for (const other of location.connections) {
      assert.ok(LOCATIONS[other], `${id} 的连接 ${other} 存在`)
      assert.ok(LOCATIONS[other].connections.includes(id), `${id}↔${other} 对称`)
    }
  }
  for (const era of ERAS) assert.ok(Object.values(LOCATIONS).some(location => location.era === era))
  for (const token of ['skull', 'cultist', 'tablet', 'elderthing']) {
    assert.ok(TOKEN_MEANINGS.standard[token].delta < 0)
    assert.ok(TOKEN_MEANINGS.hard[token].delta <= TOKEN_MEANINGS.standard[token].delta)
  }
})

test('Machinations：真实引擎开局布置（三时代/廷达洛斯/剧情链/随机 Plot）', () => {
  const state = startScenario({ seed: 'mtt-setup' })
  assert.equal(state.status, 'playing')
  assert.equal(state.scenario.id, SCENARIO_ID)
  assert.equal(state.locations.length, 15, '15 个地点入场（科里根工业放在一边）')
  assert.equal(state.investigators[0].location, 'tindalos')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['87004'])
  assert.deepEqual(state.agendas.map(agenda => agenda.originalCode), ['87002', '87003'])
  assert.equal(state.agendas[0].doom, 1, '普通难度 1 人：密谋 1a 初始 1 毁灭')
  assert.equal(state.encounterDeck.length, 33)
  const zones = state.scenarioZones
  assert.deepEqual(zones.storyCards.filter(story => story.role === 'nobleLegacy').map(story => story.code).sort(), ['87006', '87015', '87024'])
  assert.ok(MACHINATION_CODES.includes(zones.machinationCode))
  assert.ok(PLOT_CODES.includes(zones.plotCode))
  // A Noble Legacy Setup 的资产位置。
  assert.equal(zones.assets['87014'].location, 'riverDocksPast')
  assert.equal(zones.assets['87023'].location, 'arkhamAdvertiserPresent')
  // 难度调整：困难 +1 / 简单 -1（最少 0）。
  const hard = startScenario({ seed: 'mtt-hard', difficulty: 'hard' })
  assert.equal(hard.agendas[0].doom, 2)
  const easy = startScenario({ seed: 'mtt-easy', difficulty: 'easy' })
  assert.equal(easy.agendas[0].doom, 0)
})

test('Machinations：幕目标推进→结局 1；密谋耗尽→结局 2/3/4', () => {
  const records = Object.fromEntries(NOBLE_KEYS.map(key => [key, true]))
  const winState = checkObjectiveState({ campaign: { records } })
  winState.scenarioZones.storyCards.find(story => story.role === 'plot').inPlay = false
  let finished = null
  behavior.checkObjectives(winState, { finish: key => { finished = key } })
  assert.equal(finished, 'resolution1', '三时代剧情全完成且无 Plot → 结局 1')

  const timeout = checkObjectiveState({ agendaIndex: 2, campaign: { records: {} } })
  timeout.scenarioZones.assets = { '87036b': { code: '87036b', location: 'arkhamGazette' } }
  finished = null
  behavior.checkObjectives(timeout, { finish: key => { finished = key } })
  assert.equal(finished, 'resolution2', '艾德温支援在场上 → 结局 2')

  const enemyTimeout = checkObjectiveState({ agendaIndex: 2, campaign: { records: {} } })
  enemyTimeout.enemies = [{ originalCode: '87036a' }]
  finished = null
  behavior.checkObjectives(enemyTimeout, { finish: key => { finished = key } })
  assert.equal(finished, 'resolution3', '艾德温敌人在场上 → 结局 3')

  const plainTimeout = checkObjectiveState({ agendaIndex: 2, campaign: { records: {} } })
  finished = null
  behavior.checkObjectives(plainTimeout, { finish: key => { finished = key } })
  assert.equal(finished, 'resolution4', '没有艾德温 → 结局 4')
})

test('Machinations：混乱标记读点（cultist 在廷达洛斯自动失败）', () => {
  const state = startScenario({ seed: 'mtt-token' })
  let failures = 0
  behavior.resolveChaosToken(state, state.investigators[0], 'cultist', { failSkillTest: () => { failures += 1 } })
  assert.equal(failures, 1, '廷达洛斯上 cultist 自动失败')
  state.investigators[0].location = 'arkhamGazette'
  behavior.resolveChaosToken(state, state.investigators[0], 'cultist', { failSkillTest: () => { failures += 1 } })
  assert.equal(failures, 1, '离开廷达洛斯后不自动失败')
  // 非 cultist 标记不走该读点。
  behavior.resolveChaosToken(state, state.investigators[0], 'skull', { failSkillTest: () => { failures += 1 } })
  assert.equal(failures, 1)
})

test('Machinations：存档往返保留剧情链/时代/结局元数据并可继续', () => {
  const state = startScenario({ seed: 'mtt-save' })
  const saved = JSON.parse(JSON.stringify(state))
  for (const key of ['acts', 'agendas', 'locations', 'scenarioZones', 'encounterDeck']) {
    assert.deepEqual(saved[key], JSON.parse(JSON.stringify(state[key])), `${key} 往返一致`)
  }
  assert.equal(saved.scenarioZones.storyCards.length, 5, '3 张伟大遗产 + 1 张 Machination + 1 张 Plot')
  // 复原后仍能继续（用资源行动验证状态可驱动；遭遇卡规则待条目迁移，不在此测试触发）。
  const before = saved.investigators[0].resources || 0
  const seat = saved.currentSeat
  assert.equal(validateMove(saved, seat, { action: 'resource' }), null)
  applyMove(saved, seat, { action: 'resource' })
  settle(saved)
  assert.ok((saved.investigators[0].resources || 0) >= before, '资源行动可继续执行')
})

test('Machinations：奖励/经验写回与指南源结构', () => {
  const win = { investigators: [{ seat: 0, defeated: false, insane: false }], numInvestigators: 1, scenarioZones: { assets: { '87032': { code: '87032', location: 'miskatonicUniversityFuture' } } }, scenarioFlags: {}, campaign: { records: {} } }
  const winResult = behavior.resolution(win, 'resolution1')
  assert.equal(winResult.award, true)
  assert.ok(win.scenarioFlags.rewardAssets.includes('87032'), '维度光束机器进入奖励资产')
  const lose = { investigators: [{ seat: 0, defeated: false, insane: false }], numInvestigators: 1, scenarioZones: { assets: {} }, scenarioFlags: {}, campaign: { records: {} } }
  const loseResult = behavior.resolution(lose, 'resolution3')
  assert.equal(loseResult.award, false)
  assert.equal(lose.investigators[0].insane, true, '结局 3 逼疯幸存调查员')

  const guide = JSON.parse(readFileSync(new URL('../content/scenario-guide-sources/machinationsThroughTime.json', import.meta.url), 'utf8'))
  assert.equal(guide.id, SCENARIO_ID)
  assert.equal(guide.campaignId, CAMPAIGN_ID)
  const sections = ['intro', 'setup', 'specialRules', 'story', 'resolutions']
  for (const section of sections) {
    const en = guide.locales.en[section]
    const zh = guide.locales.zh[section]
    assert.ok(Array.isArray(en) && en.length > 0, `${section} en 非空`)
    assert.deepEqual(zh.map(block => block.id), en.map(block => block.id), `${section} zh/en block id 一致`)
  }
  assert.deepEqual(guide.locales.zh.resolutions.map(block => block.id), [...campaign.manifest.resolutionIds])
})
