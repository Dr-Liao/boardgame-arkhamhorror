// 批次 2 · 支线通用流程验收 1/3：狼人诅咒（curseOfTheRougarou · 81001）。
//
// 覆盖：
//   A. 内容注册 / manifest（要求包、遭遇组、记录 schema、opening 经验、独立难度袋、flow 形状）；
//   B. 独立开局（真实引擎）：opening 构筑经验、难度与混乱袋（困难袋）、4 堆地点随机布置、
//      幕 1 推进 → 幕 1 背面（9 地点入场 / 狼人生成 / 诅咒弱点进威胁区 / 狼人组洗入）→
//      击败狼人 → 结局 2（记录、胜利区 XP、移除诅咒弱点）→ 结局决策节点 → 战役结束；
//   C. 插入主战役语义（原创宿主夹具 + 生产支线内容）：choice 选项按 eachInvestigatorXp 门槛、
//      spendExperience 全队扣费、支线结局记录回写、结束后回到宿主原定下一章。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { currentContentBundle, registerContentBundle } from '../content/registered.js'
import { manifest as campaignManifest, CHAOS_BAGS as CAMPAIGN_BAGS } from '../content/campaigns/curseOfTheRougarou/manifest.js'
import * as chapter from '../content/campaigns/curseOfTheRougarou/scenarios/curseOfTheRougarou/index.js'
import {
  scenario, LOCATIONS, PILE_TRAITS, PILE_LOCATIONS, ENCOUNTER_DECK, ROUGAROU_SET_DECK_CODES,
  ACT_CODES, AGENDA_CODES,
} from '../content/campaigns/curseOfTheRougarou/scenarios/curseOfTheRougarou/definition.js'
import { behavior } from '../content/campaigns/curseOfTheRougarou/scenarios/curseOfTheRougarou/behavior.js'
import { layout } from '../content/campaigns/curseOfTheRougarou/scenarios/curseOfTheRougarou/layout.js'
import { scenarioManifest } from '../content/scenario-manifest.js'
import { bindScenarioIdentities } from '../content/identities.js'
import { createGameState } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { legalMoves, move, settle } from './core-fixture.mjs'

const players = [{ seat: 0, role: 'human' }]
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

// ---------------------------------------------------------------------------
// A. manifest / 数据形状
// ---------------------------------------------------------------------------
test('狼人诅咒：manifest 与章节数据形状', () => {
  const bundle = currentContentBundle()
  const packs = new Map(bundle.packs.map(pack => [pack.id, pack]))
  assert.ok(packs.has('cotrCampaign'), 'cotrCampaign 包已注册')
  assert.ok(packs.get('cotrCampaign').encounterGroupIds.includes('bayou'))
  assert.ok(packs.get('cotrCampaign').encounterGroupIds.includes('rougarou'))
  assert.deepEqual([...campaignManifest.requiredPackIds], ['core', 'cotrCampaign'])
  assert.equal(campaignManifest.opening.experience, 1, '独立开局构筑经验 = side-stories.json 的 xp（81001=1）')
  assert.deepEqual(Object.keys(campaignManifest.chaosBags), ['standard', 'hard'])
  assert.equal(campaignManifest.chaosBags.standard.length, 24, '参考 side-stories.json 的标准袋 24 枚')
  assert.equal(campaignManifest.chaosBags.hard.length, 26, '参考 side-stories.json 的困难袋 26 枚')
  assert.equal(CAMPAIGN_BAGS.standard.filter(token => token === 'cultist').length, 2)
  assert.equal(CAMPAIGN_BAGS.hard.filter(token => token === 'skull').length, 3)
  for (const key of ['theRougarouContinuesToHauntTheBayou', 'theRougarouIsDestroyed',
    'theRougarouEscapedAndYouEmbracedTheCurse', 'foundAnAncientBindingStone', 'foundAStrangeDoll']) {
    assert.equal(campaignManifest.recordSchema[key], 'boolean')
  }
  const nodes = campaignManifest.flow.nodes
  assert.equal(nodes[campaignManifest.flow.start].type, 'scenario')
  const aftermath = nodes[nodes[campaignManifest.flow.start].next]
  assert.equal(aftermath.type, 'choice')
  assert.equal(aftermath.options.length, 4)
  assert.ok(aftermath.options.every(option => option.next === 'end'))
  assert.equal(nodes.end.type, 'end')

  assert.equal(Object.keys(LOCATIONS).length, 12)
  assert.deepEqual([...PILE_TRAITS].sort(), ['newOrleans', 'riverside', 'unhallowed', 'wilderness'])
  for (const pile of PILE_TRAITS) {
    assert.equal(PILE_LOCATIONS[pile].length, 3, `${pile} 堆 3 张`)
    assert.equal(PILE_LOCATIONS[pile].filter(id => LOCATIONS[id].traits.includes('Bayou')).length, 1, `${pile} 堆 1 张 Bayou`)
  }
  assert.equal(ACT_CODES.length, 2)
  assert.equal(AGENDA_CODES.length, 3)
  assert.equal(ENCOUNTER_DECK.length, 18, '初始遭遇牌库 = The Bayou 组 18 张')
  assert.ok(ENCOUNTER_DECK.every(code => ['81022', '81023', '81024', '81025', '81026', '81027'].includes(code)))
  assert.equal(ROUGAROU_SET_DECK_CODES.length, 7, '狼人组除 81028 本体与剧情资产 81030 外 7 张洗入')
  assert.ok(chapter.manifest.recordWrites.includes('theRougarouIsDestroyed'))
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('rougarou'))
})

// ---------------------------------------------------------------------------
// B. 独立开局全链路（真实引擎）
// ---------------------------------------------------------------------------
test('狼人诅咒：独立开局 → 幕 1 背面 → 结局 2 → 决策节点 → 战役结束', () => {
  if (runChild('狼人诅咒：独立开局')) return
  const state = createGameState({ campaignId: 'curseOfTheRougarou', campaignHub: true, difficulty: 'hard', seed: 'rougarou-standalone' }, players)
  assert.equal(state.uiState, 'campaignHub')
  assert.deepEqual(campaignManifest.opening, { experience: 1 })
  assert.equal(viewState(state, 0).campaign.opening.experience, 1, '大厅看到独立开局构筑经验 1')
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  settle(state)
  for (const action of ['hubAutoDeck', 'hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) {
    move(state, { action })
    settle(state)
  }
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.difficulty, 'hard')
  assert.deepEqual([...state.chaosBag].sort(), [...CAMPAIGN_BAGS.hard].sort())
  assert.equal(state.locations.length, 3)
  const start = state.investigators[0].location
  assert.ok(LOCATIONS[start].traits.includes('Bayou'), `起始地点 ${start} 是 Bayou`)
  assert.equal(state.acts[0].code, '81005')
  assert.equal(state.acts[0].objective.atLocation, start)
  assert.equal(state.agendas[0].code, '81002')
  // 幕 1：起始 Bayou 地点凑齐 1[per_investigator] 线索后推进。
  state.investigators[0].clues = 1
  assert.ok(legalMoves(state).some(item => item.action === 'advanceAct'), '可推进幕 1')
  move(state, { action: 'advanceAct' })
  settle(state)
  assert.equal(state.locations.length, 9, '幕 1 背面把放一边的地点全部入场')
  assert.equal(state.actIndex, 1)
  assert.equal(state.acts[1].code, '81006')
  const rougarou = state.enemies.find(enemy => enemy.code === '81028')
  assert.ok(rougarou, '狼人生成')
  assert.notEqual(rougarou.location, start, '狼人生成在非河口地点')
  assert.ok(state.investigators[0].threat.some(card => card.code === '81029'), '队长威胁区放入狼人诅咒弱点')
  assert.equal((state.scenarioZones?.setAsideLocations || []).length, 6)
  // 结局 2：击败狼人后任意行动触发 checkObjectives。
  state.enemies = state.enemies.filter(enemy => enemy.code !== '81028')
  const anyMove = legalMoves(state).find(item => ['investigate', 'draw', 'move', 'endTurn'].includes(item.action))
  assert.ok(anyMove, '仍有合法行动以触发目标检查')
  move(state, { action: anyMove.action, ...(anyMove.locationId ? { locationId: anyMove.locationId } : {}) })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.resolution, 'resolution2')
  assert.equal(state.campaign.records.theRougarouIsDestroyed, true)
  assert.equal(state.campaign.records.theRougarouContinuesToHauntTheBayou, undefined)
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result.scenarioId, 'curseOfTheRougarou')
  assert.equal(result.resolution, 'resolution2')
  assert.equal(state.investigators[0].threat.some(card => card.code === '81029'), true, '结算时弱点仍在（存档快照）')
  // 决策节点：按剧本结局过滤后只有一条可用选项。
  move(state, { action: 'hubContinue' })
  settle(state)
  assert.ok(state.pendingChoice, '出现结局决策选择')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['recordedDestroyed'])
  settle(state, () => 'recordedDestroyed')
  assert.equal(state.uiState, 'campaignResult', '支线战役结束')
})

// ---------------------------------------------------------------------------
// C. 插入主战役（原创宿主夹具 + 生产支线内容）
// ---------------------------------------------------------------------------
test('狼人诅咒：插入主战役的 XP 费用、记录回写与返回下一章（宿主夹具）', () => {
  if (runChild('狼人诅咒：插入主战役')) return
  const fixture = hostFixture()
  registerContentBundle({ campaigns: [fixture.campaign], scenarios: fixture.scenarios })
  const state = createGameState({ campaignId: 'sideStoryHostFixture', campaignHub: true, seed: 'host-fixture' }, players)
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  settle(state)
  for (const action of ['hubAutoDeck', 'hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) {
    move(state, { action })
    settle(state)
  }
  move(state, { action: 'resign' })
  settle(state)
  if (state.uiState === 'scenarioResult') move(state, { action: 'hubContinue' })
  settle(state)
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['rougarou', 'continue'])
  const before = state.campaign.investigators[0].xp
  assert.ok(before >= 1)
  settle(state, () => 'rougarou')
  assert.equal(state.campaign.investigators[0].xp, before - 1, '插入前每人扣 1 XP')
  for (const action of ['hubBeginScenario']) { move(state, { action }); settle(state) }
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'curseOfTheRougarou')
  // 幕 1 推进 → 背面 → 击败狼人 → R2。
  state.investigators[0].clues = 1
  assert.ok(legalMoves(state).some(item => item.action === 'advanceAct'))
  move(state, { action: 'advanceAct' })
  settle(state)
  state.enemies = state.enemies.filter(enemy => enemy.code !== '81028')
  const anyMove = legalMoves(state).find(item => ['investigate', 'draw', 'move', 'endTurn'].includes(item.action))
  assert.ok(anyMove)
  move(state, { action: anyMove.action, ...(anyMove.locationId ? { locationId: anyMove.locationId } : {}) })
  settle(state, choice => (choice.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.campaign.records.theRougarouIsDestroyed, true, '支线记录写回宿主战役')
  move(state, { action: 'hubContinue' })
  settle(state)
  // 支线结束后宿主 flow 从 rougarou 节点继续到 return（原定下一章）。
  assert.equal(state.scenario?.id, 'hostReturn')
  if (state.uiState === 'scenarioSetup') {
    move(state, { action: 'hubBeginScenario' })
    settle(state)
  }
  move(state, { action: 'resign' })
  settle(state)
  assert.equal(state.campaign.records.hostReturned, true, '返回原定下一章并在那里结算')
})

function hostFixture() {
  const hostCampaignId = 'sideStoryHostFixture'
  const sideManifest = scenarioManifest(scenario, chapter.identities, {
    campaignId: hostCampaignId, status: 'playable', layout,
    requiredPackIds: ['core', 'cotrCampaign'],
    requiredEncounterGroupIds: ['bayou', 'rougarou'],
    setAsideAliases: [...chapter.SET_ASIDE_ALIASES],
    recordReads: [], recordWrites: [], behaviorIds: [behavior.id],
  })
  sideManifest.referenceCode = '81001'
  const simpleScenario = (id, name) => {
    const data = {
      id, name, startLocation: 'bench', resignAnywhere: true,
      setup: '将调查员放在工作台。', setupNote: '从工作台开始。',
      locations: { bench: { id: 'bench', name: '工作台', shroud: 0, cluesPerInvestigator: 0, connections: [] } },
      acts: [{ id: 'measure', stage: '1a', name: '测量', objective: { type: 'manual' } }],
      agendas: [{ id: 'timer', stage: '1a', name: '计时', doomThreshold: 9 }],
      encounterDeck: [], enemies: {}, treacheries: {}, storyAssets: {},
      mechanics: { noEncounterDeck: true }, resolutions: { r1: '校验结束。' },
    }
    const identities = { locations: { bench: { originalCode: '01113' } } }
    bindScenarioIdentities(data, identities)
    return { data, identities }
  }
  const opening = simpleScenario('hostOpening', '宿主开场')
  const openingEntry = {
    scenario: opening.data,
    behavior: { id: 'hostOpening', setupLocations: () => ['bench'],
      allResigned: (_, { finish }) => finish('r1'), resolution: () => ({ award: false }) },
    manifest: scenarioManifest(opening.data, opening.identities, {
      campaignId: hostCampaignId, status: 'playable',
      layout: { locations: { bench: { x: 0, y: 0 } }, edges: [] },
      behaviorIds: ['hostOpening'], requiredPackIds: ['core'], requiredEncounterGroupIds: [],
    }),
  }
  const ret = simpleScenario('hostReturn', '宿主收尾')
  const returnEntry = {
    scenario: ret.data,
    behavior: { id: 'hostReturn', setupLocations: () => ['bench'],
      allResigned: (_, { finish }) => finish('r1'),
      resolution: () => ({ award: false, effects: [{ record: { hostReturned: true } }] }) },
    manifest: scenarioManifest(ret.data, ret.identities, {
      campaignId: hostCampaignId, status: 'playable',
      layout: { locations: { bench: { x: 0, y: 0 } }, edges: [] },
      behaviorIds: ['hostReturn'], requiredPackIds: ['core'], requiredEncounterGroupIds: [],
      recordWrites: ['hostReturned'],
    }),
  }
  const campaign = {
    schemaVersion: campaignManifest.schemaVersion, id: hostCampaignId, name: '宿主战役',
    contentVersion: '1.0.0', minRulesVersion: 'n6.0', status: 'playable',
    requiredPackIds: ['core', 'cotrCampaign'],
    opening: { experience: 0 },
    scenarioIds: ['hostOpening', 'curseOfTheRougarou', 'hostReturn'],
    unlock: { hostOpening: [], curseOfTheRougarou: ['hostOpening'], hostReturn: ['curseOfTheRougarou'] },
    chaosBags: { standard: [...CAMPAIGN_BAGS.standard] },
    recordSchema: { ...campaignManifest.recordSchema, hostReturned: 'boolean' },
    recordLabels: {},
    interludeHandlerId: 'hostInterlude',
    resolutionIds: ['survived'],
    flow: {
      start: 'opening',
      nodes: {
        opening: { type: 'scenario', scenarioId: 'hostOpening', next: 'between' },
        between: { type: 'choice', options: [
          { id: 'rougarou', label: '插入支线：狼人诅咒（每人 1 XP）', when: { eachInvestigatorXp: 1 },
            effects: [{ type: 'spendExperience', amount: 1 }], next: 'rougarou' },
          { id: 'continue', label: '继续主线', next: 'return' },
        ] },
        rougarou: { type: 'scenario', scenarioId: 'curseOfTheRougarou', next: 'return' },
        return: { type: 'scenario', scenarioId: 'hostReturn', next: 'end' },
        end: { type: 'end' },
      },
    },
  }
  return { campaign, scenarios: [openingEntry, { scenario, behavior, manifest: sideManifest }, returnEntry] }
}

