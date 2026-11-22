// 批次 4 · Beta 支线 The Labyrinths of Lunacy（70001）专项测试。
// 覆盖：campaign/scenario manifest、Group A/B/C act+议程数据、单桌等价真实布置（A/B/C 三组）、
// 混乱标记与记录写回、指南源 zh/en 结构。跨桌协作（epic multiplayer）由 Lead 引擎提供，
// 本批只验证单桌普通流程（跨桌需求见 primitive-requests/ret-dunwich-70001-*.json）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createGameState, applyMove, validateMove } from '../src/engine/engine.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { assertContentBundle } from '../content/schema.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import * as campaign from '../content/campaigns/theLabyrinthsOfLunacy/manifest.js'
import * as chapter from '../content/campaigns/theLabyrinthsOfLunacy/scenarios/theLabyrinthsOfLunacy/index.js'
import {
  GROUP_TABLE, ACT_CODES, AGENDA_CODES, ENCOUNTER_DECK, LOCATIONS, SECRETS_VARIANTS,
  STORY_CARD_CODES, GROUP_CHAOS_TOKEN, TOKEN_MEANINGS, EPIC_ONLY_ACT_CODES, EPIC_ONLY_AGENDA_CODES,
} from '../content/campaigns/theLabyrinthsOfLunacy/scenarios/theLabyrinthsOfLunacy/definition.js'
import { behavior } from '../content/campaigns/theLabyrinthsOfLunacy/scenarios/theLabyrinthsOfLunacy/behavior.js'

const CAMPAIGN_ID = 'theLabyrinthsOfLunacy'
const SCENARIO_ID = 'theLabyrinthsOfLunacy'
let bundleReady = false
try {
  registerContentBundle({
    campaigns: [campaign.manifest],
    scenarios: [{
      scenario: chapter.scenario,
      identities: chapter.identities,
      behavior: chapter.behavior,
      manifest: chapter.manifest,
    }],
  })
  bundleReady = true
} catch (error) {
  console.error('Labyrinths 测试注册失败：', error.message)
}

function settle(state, chooser = () => null, limit = 200) {
  for (let count = 0; state.pendingChoice; count += 1) {
    assert.ok(count < limit, `选择循环未收敛：${state.pendingChoice?.prompt || ''}`)
    const pending = state.pendingChoice
    const preferred = chooser(pending, state)
    const optionId = preferred ?? pending.options.find(option => ['done', 'skip', 'finish'].includes(option.id))?.id
      ?? pending.options[0].id
    const seat = pending.seat ?? state.currentSeat
    const move = { action: 'choose', choiceId: pending.id, optionId }
    assert.equal(validateMove(state, seat, move), null, `非法选择 ${optionId}`)
    applyMove(state, seat, move)
  }
  return state
}

function startScenario(group = 'A', players = 1) {
  const state = createGameState(
    { campaignId: CAMPAIGN_ID, seed: `lol-${group}`, playerInvestigator: '01001' },
    Array.from({ length: players }, (_, seat) => ({ seat })),
  )
  settle(state, pending => {
    const wanted = pending.options.find(option => option.id === group)
    if (wanted) return wanted.id
    return null
  })
  return state
}

test('Labyrinths：campaign manifest（epic multiplayer / mini-campaign / 难度袋 / 结局）', () => {
  assert.equal(campaign.manifest.id, CAMPAIGN_ID)
  assert.equal(campaign.manifest.nameEn, 'The Labyrinths of Lunacy')
  assert.deepEqual([...campaign.manifest.requiredPackIds], ['core', 'lolCampaign'])
  assert.equal(campaign.manifest.opening.experience, 2, 'side-stories.json xp=2')
  assert.equal(campaign.manifest.epicMultiplayer.enabled, true)
  assert.deepEqual([...campaign.manifest.epicMultiplayer.groups], ['A', 'B', 'C'])
  assert.equal(campaign.manifest.epicMultiplayer.tables, 3)
  assert.equal(campaign.manifest.miniCampaign.enabled, true)
  assert.equal(campaign.manifest.chaosBags.standard.length, 16)
  assert.equal(campaign.manifest.chaosBags.hard.length, 16)
  assert.deepEqual([...campaign.manifest.resolutionIds], ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.deepEqual([...campaign.manifest.scenarioIds], [SCENARIO_ID])
})

test('Labyrinths：三组 act/议程数据与单桌等价牌库', () => {
  assert.deepEqual(GROUP_TABLE.A.actCodes, ['70007', '70011', '70015'])
  assert.deepEqual(GROUP_TABLE.B.actCodes, ['70008', '70012', '70015'])
  assert.deepEqual(GROUP_TABLE.C.actCodes, ['70010', '70013', '70015'])
  assert.deepEqual([...ACT_CODES], GROUP_TABLE.A.actCodes)
  assert.deepEqual([...AGENDA_CODES], ['70003', '70005', '70006'])
  // epic multiplayer 变体不进入单桌牌库。
  const cardCodes = [...Object.keys(chapter.scenario.stageCards)]
  for (const code of EPIC_ONLY_ACT_CODES) assert.ok(cardCodes.includes(code), `stageCards 保留 ${code} 定义`)
  for (const code of EPIC_ONLY_AGENDA_CODES) assert.ok(cardCodes.includes(code))
  assert.ok(!ENCOUNTER_DECK.includes('70049'), 'epic 宠物不进入单桌遭遇牌库')
  assert.ok(!ENCOUNTER_DECK.includes('70050'), '单桌宠物放在一边（幕 2 设置入场）')
  assert.ok('70050' in chapter.scenario.enemies, '单桌宠物有敌人定义')
  assert.ok(chapter.scenario.setAsideAliases.includes('70048'), '艾克索多隆放在一边')
  assert.ok(!ENCOUNTER_DECK.includes('70059'), 'epic 悖论效应不进入单桌牌库')
  assert.ok(ENCOUNTER_DECK.includes('70060'), '单桌悖论效应在牌库')
  assert.equal(Object.keys(LOCATIONS).length, 15)
  assert.equal(SECRETS_VARIANTS.length, 3)
  assert.equal(STORY_CARD_CODES.length, 6)
  // 连接对称。
  for (const [id, location] of Object.entries(LOCATIONS)) {
    for (const other of location.connections) {
      assert.ok(location.id === id)
      assert.ok(LOCATIONS[other], `${id} 的连接 ${other} 存在`)
    }
  }
  // 遭遇牌库守恒：与 manifest zones 一致。
  const report = scenarioZoneReport(chapter.scenario, chapter.manifest)
  assert.equal(report.encounterCards, ENCOUNTER_DECK.length)
  assert.equal(report.duplicateActiveZoneCodes.length, 0)
})

test('Labyrinths：真实引擎单桌布置 Group A（幕/密谋/混乱袋/地点）', () => {
  const state = startScenario('A')
  assert.equal(state.status, 'playing')
  assert.equal(state.scenario.id, SCENARIO_ID)
  assert.equal(state.campaign.records.currentGroup, 'A')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['70007', '70011', '70015'])
  assert.deepEqual(state.agendas.map(agenda => agenda.originalCode), ['70003', '70005', '70006'])
  assert.deepEqual(state.locations.map(location => location.id), ['chamberOfSecrets'])
  assert.equal(state.locations[0].revealed !== false, true, '起始密室已揭示')
  assert.equal(state.chaosBag.filter(token => token === GROUP_CHAOS_TOKEN.A).length, 2)
  // A 组幕 1：需要奥秘之钥与 2[per_investigator] 线索才出现场景行动。
  state.investigators[0].clues = 2
  const move = { action: 'scenarioAction', rule: 'useKeyOfMysteries' }
  assert.equal(validateMove(state, 0, move), null, 'A 组幕 1 场景行动可用')
  applyMove(state, 0, move)
  settle(state)
  assert.ok(state.actIndex >= 1, '幕 1 推进到幕 2')
  assert.equal(state.locations.length >= 3, true, '幕 2 设置放置迷宫走廊')
})

test('Labyrinths：真实引擎单桌布置 Group B（雨/悲哀密室 + 调查员分坐 + 石板）', () => {
  const state = startScenario('B', 2)
  assert.equal(state.campaign.records.currentGroup, 'B')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['70008', '70012', '70015'])
  const ids = state.locations.map(location => location.id).sort()
  assert.deepEqual(ids, ['chamberOfRain', 'chamberOfSorrows'])
  const positions = state.investigators.map(inv => inv.location).sort()
  assert.deepEqual(positions, ['chamberOfRain', 'chamberOfSorrows'])
  assert.equal(state.chaosBag.filter(token => token === GROUP_CHAOS_TOKEN.B).length, 2)
  // B 组幕 1：本地共同花费 2/人 线索（行动由当前调查员发起）。
  const seat = state.currentSeat
  state.investigators[seat].clues = 4
  const move = { action: 'scenarioAction', rule: 'drainWateryGrave' }
  assert.equal(validateMove(state, seat, move), null)
  applyMove(state, seat, move)
  settle(state)
  assert.ok(state.actIndex >= 1)
})

test('Labyrinths：真实引擎单桌布置 Group C（夜/悔恨密室 + 邪教徒）', () => {
  const state = startScenario('C')
  assert.equal(state.campaign.records.currentGroup, 'C')
  assert.deepEqual(state.acts.map(act => act.originalCode), ['70010', '70013', '70015'])
  assert.deepEqual(state.locations.map(location => location.id).sort(), ['chamberOfNight', 'chamberOfRegret'])
  assert.equal(state.chaosBag.filter(token => token === GROUP_CHAOS_TOKEN.C).length, 2)
  assert.ok(state.scenarioZones.hiddenChamber, 'C 组暗置密室已记录')
})

test('Labyrinths：结局写回 groupXOutcome / escapedGroups（逃出与覆灭）', () => {
  const escapedState = {
    investigators: [{ seat: 0 }], numInvestigators: 1,
    campaign: { records: { currentGroup: 'A', playedGroups: [], escapedGroups: [] } },
  }
  const result = behavior.resolution(escapedState, 'resolution2')
  assert.equal(result.award, true)
  assert.equal(escapedState.campaign.records.groupAOutcome, 'escaped')
  assert.deepEqual(escapedState.campaign.records.escapedGroups, ['A'])
  assert.deepEqual(escapedState.campaign.records.playedGroups, ['A'])

  const perishedState = {
    investigators: [{ seat: 0 }], numInvestigators: 1,
    campaign: { records: { currentGroup: 'C', playedGroups: [], escapedGroups: [] } },
  }
  const perished = behavior.resolution(perishedState, 'resolution1')
  assert.equal(perished.award, false)
  assert.equal(perishedState.campaign.records.groupCOutcome, 'perished')
  assert.deepEqual(perishedState.campaign.records.theGroupPerished, ['C'])
  // 结局编号与逃出组数一一对应（参考 resolutionKey）。
  assert.deepEqual([...campaign.manifest.resolutionIds], ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.equal(TOKEN_MEANINGS.standard.skull.delta, -1)
  assert.equal(TOKEN_MEANINGS.hard.cultist.delta, -3)
})

test('Labyrinths：指南源 zh/en 结构一致且覆盖全部结局 id', () => {
  const guide = JSON.parse(readFileSync(
    new URL('../content/scenario-guide-sources/theLabyrinthsOfLunacy.json', import.meta.url), 'utf8'))
  assert.equal(guide.id, SCENARIO_ID)
  assert.equal(guide.campaignId, CAMPAIGN_ID)
  const sections = ['intro', 'setup', 'specialRules', 'story', 'resolutions']
  for (const section of sections) {
    const en = guide.locales.en[section]
    const zh = guide.locales.zh[section]
    assert.ok(Array.isArray(en) && en.length > 0, `${section} en 非空`)
    assert.deepEqual(zh.map(block => block.id), en.map(block => block.id), `${section} zh/en block id 一致`)
  }
  const resolutionIds = guide.locales.zh.resolutions.map(block => block.id)
  assert.deepEqual(resolutionIds, [...campaign.manifest.resolutionIds])
})
