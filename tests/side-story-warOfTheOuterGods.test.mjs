// 批次 4 · Beta 支线验收：外神之战（warOfTheOuterGods · 86001）。
//
// 覆盖：
//   A. manifest / 章节数据形状（包、遭遇组、4 档袋、三套阵营议程、11 张地点、放一边卡）；
//   B. 独立开局（真实引擎）：Standard 袋、10 张地点入场、3 张 1a 议程、3 名邪教徒按 Spawn 生成；
//   C. 三方进度：阵营毁灭阈值 6 推进，任一阵营抵达终局议程 → 战争结束（Hub 翻面、上古存在入场、
//      败方敌人退场、终局议程替换）；
//   D. 幕目标：幕 2/3 把线索放到 Hub Dimension 周围 → 封住 → 结局 1；
//   E. 结局映射与记录（resolution1–7 / 无结局按领先阵营映射 / 故事资产与战败效果）；
//   F. 存档 JSON 往返（阵营进度/战争状态/结局选择可恢复）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { currentContentBundle, registerContentBundle } from '../content/registered.js'
import { manifest as campaignManifest, CHAOS_BAGS } from '../content/campaigns/warOfTheOuterGods/manifest.js'
import * as chapter from '../content/campaigns/warOfTheOuterGods/scenarios/warOfTheOuterGods/index.js'
import {
  scenario, ENCOUNTER_DECK, ACT_CODES, FACTION_KEYS, FACTION_AGENDA_CODES, FACTION_FINAL_AGENDA,
  FACTION_ANCIENT_ONE, STORY_ASSET_CODES, HUB_CODE, SET_ASIDE_CODES, LOCATION_TABLE,
} from '../content/campaigns/warOfTheOuterGods/scenarios/warOfTheOuterGods/definition.js'
import { behavior } from '../content/campaigns/warOfTheOuterGods/scenarios/warOfTheOuterGods/behavior.js'
import { createGameState } from '../src/engine/engine.js'
import { legalMoves, move, settle } from './core-fixture.mjs'
import { driveHub, players } from './side-story-harness.mjs'

if (!currentContentBundle().campaigns.some(item => item.id === campaignManifest.id)) {
  registerContentBundle({ campaigns: [campaignManifest], scenarios: [chapter] })
}

// 轻量场景运行时桩：记录引擎钩子调用（真实引擎里这些动作由 scenarioRuntime 提供）。
function runtimeStub(state) {
  const calls = {}
  const api = {
    info: () => {},
    spawn: (code, locationId) => {
      const enemy = {
        id: `${code}-stub-${state.enemies.length + 1}`, code, originalCode: code,
        name: code, fight: 1, evade: 1, health: 10, damage: 1, horror: 1,
        damageTaken: 0, location: locationId ?? null, engagedSeat: null, exhausted: false,
      }
      state.enemies.push(enemy)
      return enemy
    },
    advanceAct: () => { state.actIndex = (state.actIndex || 0) + 1; calls.advanceAct = true },
    finish: key => { calls.finish = key },
    test: (seat, skill, difficulty, callback) => callback({ success: true, successBy: 2 }),
  }
  api.calls = calls
  return api
}

test('外神之战：manifest 与章节数据形状', () => {
  const packs = new Map(currentContentBundle().packs.map(pack => [pack.id, pack]))
  assert.ok(packs.has('wogCampaign'), 'wogCampaign 包已注册')
  assert.deepEqual([...campaignManifest.requiredPackIds], ['core', 'wogCampaign'])
  assert.equal(campaignManifest.opening.experience, 3, '独立开局构筑经验 = side-stories.json 的 xp（86001=3）')
  assert.deepEqual(Object.keys(campaignManifest.chaosBags), ['easy', 'standard', 'hard', 'expert'])
  assert.equal(CHAOS_BAGS.easy.length, 15)
  assert.equal(CHAOS_BAGS.standard.length, 15)
  assert.equal(CHAOS_BAGS.hard.length, 15)
  assert.equal(CHAOS_BAGS.expert.length, 14, 'Expert 袋在 side-stories.json 中为 14 个标记')
  assert.equal(CHAOS_BAGS.standard.filter(token => token === 'skull').length, 3)
  assert.equal(CHAOS_BAGS.expert.filter(token => token === 'autofail').length, 1)
  assert.equal(campaignManifest.resolutionIds.length, 8)
  for (const key of ['preventedAllOuterGods', 'silenusBanished', 'redFactionWon']) {
    assert.equal(campaignManifest.recordSchema[key], 'boolean')
  }
  const nodes = campaignManifest.flow.nodes
  const aftermath = nodes[nodes[campaignManifest.flow.start].next]
  assert.equal(aftermath.type, 'choice')
  assert.equal(aftermath.options.length, 7)
  assert.equal(ACT_CODES.length, 3, '幕 1–3')
  assert.equal(FACTION_KEYS.length, 3, '三阵营')
  assert.equal(Object.values(FACTION_AGENDA_CODES).flat().length, 9, '三套阵营议程各 3 张')
  assert.equal(LOCATION_TABLE.length, 11, '10 张地点入场 + Hub Dimension 放一边')
  assert.equal(Object.keys(scenario.locations).length, 11)
  assert.equal(STORY_ASSET_CODES.length, 5)
  assert.ok(SET_ASIDE_CODES.includes(HUB_CODE))
  for (const code of Object.values(FACTION_FINAL_AGENDA)) assert.ok(SET_ASIDE_CODES.includes(code))
  for (const code of Object.values(FACTION_ANCIENT_ONE)) assert.ok(SET_ASIDE_CODES.includes(code))
  assert.ok(ENCOUNTER_DECK.length >= 17, `初始遭遇牌库 ${ENCOUNTER_DECK.length} 张`)
  for (const code of ['86025', '86027', '86029']) assert.ok(!ENCOUNTER_DECK.includes(code), '布置邪教徒不在遭遇牌库')
})

test('外神之战：独立开局（真实引擎）与布置', () => {
  const state = createGameState({
    campaignId: 'warOfTheOuterGods', campaignHub: true, difficulty: 'standard', seed: 'wog-standalone',
  }, players)
  assert.deepEqual(campaignManifest.opening, { experience: 3 })
  driveHub(state, { investigator: '01002' })
  assert.equal(state.uiState, 'inScenario')
  assert.deepEqual([...state.chaosBag].sort(), [...CHAOS_BAGS.standard].sort())
  assert.equal(state.locations.length, 10, 'Hub Dimension 放一边，其余 10 张入场')
  assert.ok(!state.locations.some(location => location.id === 'hubDimension'))
  assert.equal(state.investigators[0].location, 'arkham')
  assert.equal(state.acts[0].code, '86011')
  assert.equal(state.agendas.length, 3, '三套阵营议程同时在场')
  assert.deepEqual(state.agendas.map(card => card.code), ['86005', '86002', '86008'])
  const wog = state.scenarioFlags.wog
  assert.deepEqual(Object.keys(wog.factions).sort(), ['blue', 'green', 'red'])
  assert.equal(wog.factions.green.step, 1)
  assert.equal(wog.warOver, false)
  const cultists = state.enemies.filter(enemy => ['86025', '86027', '86029'].includes(enemy.code))
  assert.equal(cultists.length, 3, '布置时 3 名邪教徒按 Spawn 指示生成')
  const byCode = new Map(cultists.map(enemy => [enemy.code, enemy.location]))
  assert.equal(byCode.get('86025'), 'athenaeumOfTheEmptySky')
  assert.equal(byCode.get('86027'), 'shrineOfMaghanArkat')
  assert.equal(byCode.get('86029'), 'theBurningPit')
  assert.ok(state.encounterDeck.length >= 15, `遭遇牌库 ${state.encounterDeck.length} 张`)
  assert.ok(legalMoves(state).length > 0)
})

test('外神之战：三方阵营毁灭阈值与战争结束（warIsOver）', () => {
  const state = createGameState({
    campaignId: 'warOfTheOuterGods', campaignHub: true, difficulty: 'standard', seed: 'wog-factions',
  }, players)
  driveHub(state, { investigator: '01002' })
  const api = runtimeStub(state)
  // 低于阈值不推进。
  behavior.addDoomToFaction(state, 'green', 5, api)
  assert.equal(state.scenarioFlags.wog.factions.green.step, 1)
  // 第 6 点：推进到第 2 张，毁灭清零。
  behavior.addDoomToFaction(state, 'green', 1, api)
  assert.equal(state.scenarioFlags.wog.factions.green.step, 2)
  assert.equal(state.scenarioFlags.wog.factions.green.doom, 0)
  // 再走两轮阈值 → 终局议程（step 4）→ 战争结束。
  behavior.addDoomToFaction(state, 'green', 6, api)
  behavior.addDoomToFaction(state, 'green', 6, api)
  const wog = state.scenarioFlags.wog
  assert.equal(wog.warOver, true)
  assert.equal(wog.winner, 'green')
  assert.deepEqual([...wog.defeatedFactions].sort(), ['blue', 'red'])
  assert.equal(state.agendas.length, 1, '终局议程替换三套阵营议程')
  assert.equal(state.agendas[0].code, FACTION_FINAL_AGENDA.green)
  const hub = state.locations.find(location => location.id === 'hubDimension')
  assert.ok(hub, 'Hub Dimension 翻面入场')
  assert.equal(hub.revealed, true)
  assert.ok(hub.connections.includes('arkham'), 'Hub 与每个 Ritual Site 相连')
  const ancient = state.enemies.find(enemy => enemy.code === FACTION_ANCIENT_ONE.green)
  assert.ok(ancient, '胜方上古存在入场')
  assert.equal(ancient.location, 'hubDimension')
  assert.ok(!state.enemies.some(enemy => enemy.code === '86037'), '败方阵营敌人退场')
})

test('外神之战：幕 2/3 封住传送门 → 结局 1', () => {
  const state = createGameState({
    campaignId: 'warOfTheOuterGods', campaignHub: true, difficulty: 'standard', seed: 'wog-act',
  }, players)
  driveHub(state, { investigator: '01002' })
  const api = runtimeStub(state)
  // 幕 1：战争结束（蓝方）后 checkObjectives 推进幕 1 → 幕 2。
  behavior.addDoomToFaction(state, 'blue', 18, api)
  assert.equal(state.scenarioFlags.wog.warOver, true)
  behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 1, '战争结束推进幕 1')
  assert.equal(state.acts[state.actIndex].code, '86012')
  // 幕 2：在 Ritual Site 的封门行动（3 次 → Hub 周围 3+ 线索）→ 推进幕 2。
  const inv = state.investigators[0]
  inv.location = 'arkham'
  inv.clues = 3
  behavior.performAction(state, inv, { rule: 'wogSealPortal' }, api)
  behavior.performAction(state, inv, { rule: 'wogSealPortal' }, api)
  behavior.performAction(state, inv, { rule: 'wogSealPortal' }, api)
  assert.ok(state.scenarioFlags.wog.cluesAroundHub >= 3, `Hub 周围线索 ${state.scenarioFlags.wog.cluesAroundHub}`)
  behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 2, '封住 Hub 推进幕 2')
  assert.equal(state.scenarioFlags.wog.sealedGroups, 1)
  // 幕 3：单桌即「每个阵营都封住」→ 结局 1。
  behavior.checkObjectives(state, api)
  assert.equal(api.calls.finish, 'resolution1')
})

test('外神之战：结局映射、记录与故事资产奖励', () => {
  const state = createGameState({
    campaignId: 'warOfTheOuterGods', campaignHub: true, difficulty: 'standard', seed: 'wog-res',
  }, players)
  driveHub(state, { investigator: '01002' })
  const expectations = [
    ['resolution1', 'preventedAllOuterGods', 2],
    ['resolution2', 'theSwarmOfEzelScattered', 0],
    ['resolution3', 'silenusBanished', 0],
    ['resolution4', 'maghanArkatDestroyed', 0],
    ['resolution5', 'redFactionWon', 0],
  ]
  for (const [key, record, bonus] of expectations) {
    const result = behavior.resolution(state, key)
    assert.equal(result.bonus, bonus, `${key} 奖励经验`)
    assert.equal(result.award, true)
    const recordEffect = result.effects.find(effect => effect.record && effect.record[record])
    assert.ok(recordEffect, `${key} 写记录 ${record}`)
    if (bonus === 0) {
      const defeat = result.effects.find(effect => effect.defeatAll)
      assert.equal(Boolean(defeat), key === 'resolution5', `${key} 战败效果`)
    }
  }
  // 结局 1–4 的可选故事资产奖励。
  const r1 = behavior.resolution(state, 'resolution1')
  const story = r1.effects.filter(effect => effect.storyCard).map(effect => effect.storyCard)
  assert.deepEqual(story.sort(), [...STORY_ASSET_CODES].sort())
  // 无结局：按领先阵营映射 5/6/7。先让绿色阵营领先（第 2 张议程）→ 结局 7。
  state.scenarioFlags.wog.factions.green.step = 2
  assert.equal(behavior.resolution(state, 'noResolution').flowData.resolution, 'resolution7')
  state.scenarioFlags.wog.factions.green.step = 1
  state.scenarioFlags.wog.factions.red.step = 2
  assert.equal(behavior.resolution(state, 'noResolution').flowData.resolution, 'resolution5')
})

test('外神之战：存档 JSON 往返（阵营进度/战争状态/结局选择）', () => {
  const state = createGameState({
    campaignId: 'warOfTheOuterGods', campaignHub: true, difficulty: 'expert', seed: 'wog-save',
  }, players)
  driveHub(state, { investigator: '01002' })
  assert.deepEqual([...state.chaosBag].sort(), [...CHAOS_BAGS.expert].sort(), 'Expert 袋过滤')
  const api = runtimeStub(state)
  behavior.addDoomToFaction(state, 'red', 7, api)
  const restored = JSON.parse(JSON.stringify(state))
  const wog = restored.scenarioFlags.wog
  assert.equal(wog.factions.red.step, 2)
  assert.equal(wog.factions.red.doom, 1, '超额毁灭移到下一张议程')
  assert.deepEqual(restored.agendas.map(card => card.code), ['86005', '86002', '86008'])
  assert.equal(restored.investigators[0].location, 'arkham')
  // 恢复后继续推进：红方再拿 5 点 → 第 2 张推进。
  behavior.addDoomToFaction(restored, 'red', 5, api)
  assert.equal(restored.scenarioFlags.wog.factions.red.step, 3)
  assert.equal(typeof restored.scenario.id, 'string')
})
