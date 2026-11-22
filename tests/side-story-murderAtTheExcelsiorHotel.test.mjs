// 批次 2 · 支线通用流程验收 3/3：精益酒店谋杀案（murderAtTheExcelsiorHotel · 84001）。
//
// 覆盖：
//   A. manifest / 章节数据（要求包、6 个遭遇组、记录 schema、opening 经验 = side-stories.json xp 3、
//      独立难度袋、10 张随机真凶议程、5 张入场地点 / 5 张放一边、5 张迹象）；
//   B. 独立开局（真实引擎）：随机真凶 → 幕 1（抽 2 张迹象）→ 幕 1 背面（放一边地点入场 + 副组洗入）
//      → 幕 2（每张迹象线索达标）→ 幕 2 背面（翻到真凶议程 + 生成真凶目标）→ 击败真凶 → 结局 1
//      → 结局决策节点 → 战役结束；
//   C. 插入主战役语义（共用宿主夹具）：每人 3 XP 费用、记录写回宿主、结束后回到宿主原定下一章。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { currentContentBundle, registerContentBundle } from '../content/registered.js'
import { manifest as campaignManifest, CHAOS_BAGS as CAMPAIGN_BAGS } from '../content/campaigns/murderAtTheExcelsiorHotel/manifest.js'
import * as chapter from '../content/campaigns/murderAtTheExcelsiorHotel/scenarios/murderAtTheExcelsiorHotel/index.js'
import {
  scenario, LOCATIONS, CULPRIT_CODES, CULPRIT_TARGETS, LEADS, SETUP_LOCATION_IDS,
  SET_ASIDE_LOCATION_IDS, ENCOUNTER_DECK, ENCOUNTER_GROUPS,
} from '../content/campaigns/murderAtTheExcelsiorHotel/scenarios/murderAtTheExcelsiorHotel/definition.js'
import { createGameState } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { driveHub, hostFixtureFor, players } from './side-story-harness.mjs'

const isChild = process.env.ARKHAM_SIDE_STORY_CHILD === '1'
const runChild = name => {
  if (isChild) return false
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern', name, fileURLToPath(import.meta.url)], {
    env: { ...process.env, ARKHAM_SIDE_STORY_CHILD: '1' }, encoding: 'utf8',
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return true
}

if (!currentContentBundle().campaigns.some(item => item.id === campaignManifest.id)) {
  registerContentBundle({ campaigns: [campaignManifest], scenarios: [chapter] })
}

test('精益酒店谋杀案：manifest 与章节数据形状', () => {
  const packs = new Map(currentContentBundle().packs.map(pack => [pack.id, pack]))
  assert.ok(packs.has('hotelCampaign'), 'hotelCampaign 包已注册')
  for (const group of ['murderAtTheExcelsiorHotel', 'alienInterference', 'excelsiorManagement',
    'darkRituals', 'vileExperiments', 'sinsOfThePast']) {
    assert.ok(packs.get('hotelCampaign').encounterGroupIds.includes(group), `包内含组 ${group}`)
  }
  assert.deepEqual([...campaignManifest.requiredPackIds], ['core', 'hotelCampaign'])
  assert.equal(campaignManifest.opening.experience, 3, '独立开局构筑经验 = side-stories.json 的 xp（84001=3）')
  assert.deepEqual(Object.keys(campaignManifest.chaosBags), ['standard', 'hard'])
  assert.equal(campaignManifest.chaosBags.standard.length, 15)
  assert.equal(campaignManifest.chaosBags.hard.length, 15)
  assert.equal(CAMPAIGN_BAGS.standard.filter(token => token === 'skull').length, 2)
  assert.equal(CAMPAIGN_BAGS.hard.filter(token => token === 'elderthing').length, 1)
  for (const key of ['theExcelsiorIsQuietForNow', 'theMurdersContinueUnsolved',
    'theInvestigatorsFledTheSceneOfTheCrime', 'theExcelsiorClaimsAnotherVictim', 'excelsiorReplays']) {
    assert.equal(campaignManifest.recordSchema[key], 'boolean')
  }
  assert.equal(campaignManifest.recordSchema.theTrueCulpritWasIdentified, 'string')
  const nodes = campaignManifest.flow.nodes
  const aftermath = nodes[nodes[campaignManifest.flow.start].next]
  assert.equal(aftermath.type, 'choice')
  assert.equal(aftermath.options.length, 5, '4 个结局选项 + 再玩一次')
  assert.equal(aftermath.options[0].id, 'replay')
  assert.equal(aftermath.options[0].next, 'murderAtTheExcelsiorHotel', '再玩一次回到本关')
  assert.equal(CULPRIT_CODES.length, 10)
  assert.equal(Object.keys(CULPRIT_TARGETS).length, 10)
  assert.equal(Object.keys(LOCATIONS).length, 10)
  assert.equal(SETUP_LOCATION_IDS.length, 5)
  assert.equal(SET_ASIDE_LOCATION_IDS.length, 5)
  assert.equal(LEADS.length, 5)
  assert.equal(ENCOUNTER_GROUPS.length, 6)
  assert.equal(ENCOUNTER_DECK.length > 10, true,
    `初始遭遇牌库 = 主组敌人/诡计（副组与放一边卡不在内），共 ${ENCOUNTER_DECK.length} 张`)
})

test('精益酒店谋杀案：独立开局 → 随机真凶 → 幕 1/2 → 击败真凶 → 结局 1 → 决策节点 → 战役结束', () => {
  if (runChild('精益酒店谋杀案：独立开局')) return
  const state = createGameState({ campaignId: 'murderAtTheExcelsiorHotel', campaignHub: true, difficulty: 'standard', seed: 'excelsior-standalone' }, players)
  assert.deepEqual(campaignManifest.opening, { experience: 3 })
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  driveHub(state)
  assert.equal(state.uiState, 'inScenario')
  assert.deepEqual([...state.chaosBag].sort(), [...CAMPAIGN_BAGS.standard].sort())
  // Setup：5 张地点入场；第 3 张议程是随机真凶。
  assert.equal(state.locations.length, 5)
  assert.equal(state.investigators[0].location, 'room225')
  assert.ok(state.agendas.some(agenda => CULPRIT_CODES.includes(agenda.code)), '第 3 张议程为随机真凶')
  const culprit = state.agendas.find(agenda => CULPRIT_CODES.includes(agenda.code)).code
  const target = CULPRIT_TARGETS[culprit]
  assert.ok(target)
  // 幕 1：给团队线索，连续两次「抽迹象」→ 幕 1 目标满足。
  state.investigators[0].clues = 10
  for (let i = 0; i < 2; i++) {
    move(state, { action: 'scenarioAction', rule: 'excelsiorDrawLead', locationId: state.investigators[0].location })
    settle(state)
  }
  assert.equal(state.scenarioFlags.excelsior.leads.length, 2)
  const someMove = legalMoves(state).find(item => ['investigate', 'draw', 'move', 'endTurn'].includes(item.action))
  if (someMove) move(state, { action: someMove.action, ...(someMove.locationId ? { locationId: someMove.locationId } : {}) })
  settle(state)
  assert.equal(state.actIndex, 1, '幕 1 目标满足后推进')
  assert.equal(state.locations.length, 10, '幕 1 背面：放一边的 5 张地点全部入场')
  assert.ok(state.encounterDeck.length > 11, '幕 1 背面：按已抽迹象洗入副组')
  // 幕 2：每张迹象线索达到 1[per_investigator] → 推进。
  for (let i = 0; i < 2; i++) {
    move(state, { action: 'scenarioAction', rule: 'excelsiorPlaceLeadClue', locationId: state.investigators[0].location })
    settle(state)
  }
  assert.equal(state.actIndex, 2, '幕 2 目标满足后推进')
  assert.equal(state.agendaIndex, 2, '幕 2 背面：翻到真凶议程')
  assert.ok(state.enemies.some(enemy => enemy.code === target), '幕 2 背面：生成真凶目标敌人')
  // 击败真凶 → 结局 1（记录真凶）。
  state.enemies = state.enemies.filter(enemy => enemy.code !== target)
  const trigger = legalMoves(state).find(item => ['investigate', 'draw', 'move', 'endTurn'].includes(item.action))
  if (trigger) move(state, { action: trigger.action, ...(trigger.locationId ? { locationId: trigger.locationId } : {}) })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.resolution, 'resolution1')
  assert.equal(state.campaign.records.theExcelsiorIsQuietForNow, true)
  assert.ok(state.campaign.records.theTrueCulpritWasIdentified)
  move(state, { action: 'hubContinue' })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.ok(state.pendingChoice)
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['recordedQuiet'])
  settle(state, () => 'recordedQuiet')
  assert.equal(state.uiState, 'campaignResult')
})

test('精益酒店谋杀案：插入主战役的 XP 费用、记录回写与返回下一章（宿主夹具）', () => {
  if (runChild('精益酒店谋杀案：插入主战役')) return
  const fixture = hostFixtureFor({ campaignManifest, chapter, scenario, sideScenarioId: 'murderAtTheExcelsiorHotel', cost: 3 })
  registerContentBundle(fixture)
  const state = createGameState({ campaignId: 'sideStoryHostFixture', campaignHub: true, seed: 'excelsior-host' }, players)
  driveHub(state)
  move(state, { action: 'resign' })
  settle(state)
  if (state.uiState === 'scenarioResult') move(state, { action: 'hubContinue' })
  settle(state)
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['sideStory', 'continue'])
  const before = state.campaign.investigators[0].xp
  assert.ok(before >= 3)
  settle(state, () => 'sideStory')
  assert.equal(state.campaign.investigators[0].xp, before - 3, '插入前每人扣 3 XP')
  move(state, { action: 'hubBeginScenario' })
  settle(state)
  assert.equal(state.scenario.id, 'murderAtTheExcelsiorHotel')
  move(state, { action: 'resign' })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.campaign.records.theInvestigatorsFledTheSceneOfTheCrime, true)
  assert.equal(state.campaign.records.theMurdersContinueUnsolved, true)
  move(state, { action: 'hubContinue' })
  settle(state)
  assert.equal(state.scenario?.id, 'hostReturn')
  if (state.uiState === 'scenarioSetup') { move(state, { action: 'hubBeginScenario' }); settle(state) }
  move(state, { action: 'resign' })
  settle(state)
  assert.equal(state.campaign.records.hostReturned, true)
})


