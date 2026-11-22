// 批次 2 · 支线通用流程验收 2/3：恐怖狂欢节（carnevaleOfHorrors · 82001）。
//
// 覆盖：
//   A. manifest / 章节数据（要求包、遭遇组、记录 schema、opening 经验 = side-stories.json xp 3、
//      独立难度袋、flow 形状、8 张地点随机圆环 + 贡多拉）；
//   B. 独立开局（真实引擎）：困难袋开局 → 幕 1 目标（3 名无辜的狂欢者）→ 幕 1 背面（奈达斯奎入场）
//      → 幕 2（全员到运河畔）→ 幕 2 背面（贡多拉入场）→ 幕 3（4[per_investigator] 资源）→
//      结局 1 + 结局决策节点 → 战役结束；
//   C. 插入主战役语义（共用宿主夹具 tests/side-story-harness.mjs）：每人 3 XP 费用、记录写回宿主、
//      结束后回到宿主原定下一章。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { currentContentBundle, registerContentBundle } from '../content/registered.js'
import { manifest as campaignManifest, CHAOS_BAGS as CAMPAIGN_BAGS } from '../content/campaigns/carnevaleOfHorrors/manifest.js'
import * as chapter from '../content/campaigns/carnevaleOfHorrors/scenarios/carnevaleOfHorrors/index.js'
import {
  scenario, LOCATIONS, RING_ORDER, ENCOUNTER_DECK, ACT_CODES, AGENDA_CODES, MASK_CODES,
  SET_ASIDE_ALIASES, CNIDATHQUA_CODE, GONDOLA_CODE,
} from '../content/campaigns/carnevaleOfHorrors/scenarios/carnevaleOfHorrors/definition.js'
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

test('恐怖狂欢节：manifest 与章节数据形状', () => {
  const packs = new Map(currentContentBundle().packs.map(pack => [pack.id, pack]))
  assert.ok(packs.has('cohCampaign'), 'cohCampaign 包已注册')
  assert.ok(packs.get('cohCampaign').encounterGroupIds.includes('venice'))
  assert.deepEqual([...campaignManifest.requiredPackIds], ['core', 'cohCampaign'])
  assert.equal(campaignManifest.opening.experience, 3, '独立开局构筑经验 = side-stories.json 的 xp（82001=3）')
  assert.deepEqual(Object.keys(campaignManifest.chaosBags), ['standard', 'hard'])
  assert.equal(campaignManifest.chaosBags.standard.length, 19)
  assert.equal(campaignManifest.chaosBags.hard.length, 19)
  assert.equal(CAMPAIGN_BAGS.standard.filter(token => token === 'skull').length, 3)
  assert.equal(CAMPAIGN_BAGS.hard.filter(token => token === 'elderthing').length, 1)
  for (const key of ['manyWereSacrificedToCnidathquaDuringTheCarnivale',
    'theSunBanishedCnidathquaIntoTheDepths', 'cnidathquaRetreatedToNurseItsWounds']) {
    assert.equal(campaignManifest.recordSchema[key], 'boolean')
  }
  const nodes = campaignManifest.flow.nodes
  const aftermath = nodes[nodes[campaignManifest.flow.start].next]
  assert.equal(aftermath.type, 'choice')
  assert.equal(aftermath.options.length, 3)
  assert.equal(LOCATIONS.gondola.code, '82006b')
  assert.equal(Object.keys(LOCATIONS).length, 10)
  assert.equal(RING_ORDER.length, 9, '圆环默认 9 张地点（运行时随机移除 1 张）')
  assert.equal(MASK_CODES.length, 4)
  assert.equal(ACT_CODES.length, 3)
  assert.equal(AGENDA_CODES.length, 3)
  assert.ok(SET_ASIDE_ALIASES.includes(CNIDATHQUA_CODE))
  assert.ok(ENCOUNTER_DECK.length > 15, `初始遭遇牌库 ${ENCOUNTER_DECK.length} 张`)
  assert.ok(!ENCOUNTER_DECK.includes(CNIDATHQUA_CODE), '奈达斯奎放一边、不在初始遭遇牌库')
})

test('恐怖狂欢节：独立开局 → 幕 1/2/3 目标 → 结局 1 → 决策节点 → 战役结束', () => {
  if (runChild('恐怖狂欢节：独立开局')) return
  const state = createGameState({ campaignId: 'carnevaleOfHorrors', campaignHub: true, difficulty: 'hard', seed: 'carnevale-standalone' }, players)
  assert.deepEqual(campaignManifest.opening, { experience: 3 })
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  driveHub(state)
  assert.equal(state.uiState, 'inScenario')
  assert.deepEqual([...state.chaosBag].sort(), [...CAMPAIGN_BAGS.hard].sort())
  // Setup：随机移除 1 张，其余 8 张地点成环入场；7 名面具行人在场。
  assert.equal(state.locations.length, 8)
  const start = state.investigators[0].location
  assert.equal(start, 'sanMarcoBasilica')
  assert.equal(state.scenarioFlags.carnevale.maskedGoers, 7)
  assert.equal(state.acts[0].code, '82005')
  // 幕 1 目标：3 名无辜的狂欢者（本实现由翻面具行人累计）——直接用 behavior 事件翻 3 次。
  const flip = () => move(state, { action: 'scenarioAction', rule: 'carnevaleRevealMaskedGoer', locationId: start })
  state.investigators[0].clues = 10
  for (let i = 0; i < 3; i++) flip()
  assert.equal(state.scenarioFlags.carnevale.innocentAgenda, 3)
  settle(state)
  assert.equal(state.actIndex, 1, '幕 1 目标满足后推进到幕 2')
  const rougarouLike = state.enemies.find(enemy => enemy.code === CNIDATHQUA_CODE)
  assert.ok(rougarouLike, '幕 1 背面：奈达斯奎入场（不在任何地点）')
  assert.equal(rougarouLike.location, null)
  assert.equal(state.acts[1].code, '82006')
  // 幕 2 目标：每位未被击败的调查员都在运河畔。
  state.investigators[0].location = 'canalSide'
  const anyMove = legalMoves(state).find(item => !['hubContinue', 'advanceAct'].includes(item.action))
  if (anyMove) { move(state, { action: anyMove.action, ...(anyMove.locationId ? { locationId: anyMove.locationId } : {}) }) }
  settle(state)
  assert.equal(state.actIndex, 2, '幕 2 目标满足后推进到幕 3')
  assert.ok(state.locations.some(location => location.id === GONDOLA_CODE), '幕 2 背面：贡多拉入场')
  assert.equal(state.acts[2].code, '82007')
  // 幕 3 目标：贡多拉上 4[per_investigator] 资源。
  state.investigators[0].resources = 20
  const gondola = state.locations.find(location => location.id === GONDOLA_CODE)
  state.investigators[0].location = gondola.id
  for (let i = 0; i < 4; i++) move(state, { action: 'scenarioAction', rule: 'carnevaleRow', locationId: gondola.id })
  settle(state)
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.resolution, 'resolution1')
  assert.equal(state.campaign.records.theSunBanishedCnidathquaIntoTheDepths, true)
  move(state, { action: 'hubContinue' })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.ok(state.pendingChoice, '结局决策选择')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['recordedSun'])
  settle(state, () => 'recordedSun')
  assert.equal(state.uiState, 'campaignResult')
})

test('恐怖狂欢节：插入主战役的 XP 费用、记录回写与返回下一章（宿主夹具）', () => {
  if (runChild('恐怖狂欢节：插入主战役')) return
  const fixture = hostFixtureFor({ campaignManifest, chapter, scenario, sideScenarioId: 'carnevaleOfHorrors', cost: 3 })
  registerContentBundle(fixture)
  const state = createGameState({ campaignId: 'sideStoryHostFixture', campaignHub: true, seed: 'carnevale-host' }, players)
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
  assert.equal(state.scenario.id, 'carnevaleOfHorrors')
  // 直接结束支线（撤退）→ 记录回写宿主 → 返回原定下一章。
  move(state, { action: 'resign' })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.campaign.records.manyWereSacrificedToCnidathquaDuringTheCarnivale, true)
  move(state, { action: 'hubContinue' })
  settle(state)
  assert.equal(state.scenario?.id, 'hostReturn')
  if (state.uiState === 'scenarioSetup') { move(state, { action: 'hubBeginScenario' }); settle(state) }
  move(state, { action: 'resign' })
  settle(state)
  assert.equal(state.campaign.records.hostReturned, true)
})

