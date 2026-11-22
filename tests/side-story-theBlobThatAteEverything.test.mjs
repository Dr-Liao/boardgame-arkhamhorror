// 批次 4 · 支线通用流程验收：吞噬万物（theBlobThatAteEverything · 85001）普通流程 + ELSE! 变体。
//
// 覆盖：
//   A. 战役/两套章节数据（包与遭遇组、记录 schema、opening 经验 = side-stories.json xp 2、独立难度袋、
//      13 格网格布置、放一边/遭遇牌库分区、ELSE! 扩展数据）；
//   B. 开局台面同时提供普通流程与 ELSE! 变体两个入口 → 普通单桌起局（地点/Subject/反制措施/连接）；
//   C. 幕 1 团队线索推进 → 脆弱心脏生成 → 心脏伤害双倍转移给 Subject → 轮末强制推进幕 2；
//   D. 幕 3 背面读取 Part 1 剧情并重置幕牌库；
//   E. 击败 Subject → 结局 2 → 战役记录 + 奖励 → 关间决策 → 战役结束；
//   F. ELSE! 变体起局（14 张隔离区移除 5 张、主街连接、复制异变体、现实酸液图表近似）；
//   G. 混乱标记数值与存档 JSON 往返。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { currentContentBundle, registerContentBundle } from '../content/registered.js'
import { manifest as campaignManifest, ELSE_SCENARIO_ID, SCENARIO_ID } from '../content/campaigns/theBlobThatAteEverything/manifest.js'
import * as chapter from '../content/campaigns/theBlobThatAteEverything/scenarios/theBlobThatAteEverything/index.js'
import * as elseChapter from '../content/campaigns/theBlobThatAteEverything/scenarios/theBlobThatAteEverythingElse/index.js'
import {
  scenario, ENCOUNTER_DECK, SET_ASIDE_ALIASES, ACT_CODES, AGENDA_CODES, LOCATIONS,
  QUARANTINE_TABLE, FIXED_LOCATION_TABLE, START_LOCATION, SUBJECT_CODE, VULNERABLE_HEART_CODE,
  STORY_RULES, STORY_CODES, LOCATION_TABLE,
} from '../content/campaigns/theBlobThatAteEverything/scenarios/theBlobThatAteEverything/definition.js'
import {
  ELSE_QUARANTINE_IDS, ELSE_SET_ASIDE_CODES, LOCATIONS as ELSE_LOCATIONS,
} from '../content/campaigns/theBlobThatAteEverything/scenarios/theBlobThatAteEverythingElse/definition.js'
import { createGameState, advanceAct, damageEnemy, legalMoves } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { move, settle } from './core-fixture.mjs'

const isChild = process.env.ARKHAM_BLOB_CHILD === '1'
const runChild = name => {
  if (isChild) return false
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern', name, fileURLToPath(import.meta.url)], {
    env: { ...process.env, ARKHAM_BLOB_CHILD: '1' }, encoding: 'utf8',
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return true
}

if (!currentContentBundle().campaigns.some(item => item.id === campaignManifest.id)) {
  registerContentBundle({ campaigns: [campaignManifest], scenarios: [chapter, elseChapter] })
}

const players = [{ seat: 0, role: 'human' }]

function transact(state, execute, choose) {
  const command = { action: 'blobFixture' }
  resolveTransaction(state, 0, command, execute)
  for (let step = 0; state.pendingChoice; step++) {
    const pending = state.pendingChoice
    assert.ok(step < 40, pending.prompt)
    const optionId = choose?.(pending) ?? pending.options.find(option => option.id === 'skip')?.id
      ?? pending.options.find(option => option.id === 'done')?.id ?? pending.options[0]?.id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

function startScenario(state, scenarioId) {
  move(state, { action: 'hubSelectScenario', scenarioId })
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  settle(state)
  for (const action of ['hubAutoDeck', 'hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) {
    move(state, { action })
    settle(state)
  }
}

function newStandalone(scenarioId = SCENARIO_ID, seed = 'blob-standalone') {
  const state = createGameState({ campaignId: campaignManifest.id, campaignHub: true, difficulty: 'standard', seed }, players)
  startScenario(state, scenarioId)
  return state
}

test('吞噬万物：战役清单与普通/ELSE 两套章节数据形状', () => {
  const packs = new Map(currentContentBundle().packs.map(pack => [pack.id, pack]))
  assert.ok(packs.has('blobCampaign'), 'blobCampaign 包已注册')
  assert.ok(packs.has('blbeCampaign'), 'blbeCampaign 包已注册')
  assert.ok(packs.get('blobCampaign').encounterGroupIds.includes('theBlobThatAteEverything'))
  assert.ok(packs.get('blbeCampaign').encounterGroupIds.includes('theBlobThatAteEverythingElse'))
  assert.deepEqual([...campaignManifest.requiredPackIds], ['core', 'blobCampaign'])
  assert.deepEqual([...manifestRequired(elseChapter)], ['core', 'blobCampaign', 'blbeCampaign'])
  assert.equal(campaignManifest.opening.experience, 2, '独立开局构筑经验 = side-stories.json 的 xp（85001=2）')
  assert.deepEqual([...campaignManifest.scenarioIds], [SCENARIO_ID, ELSE_SCENARIO_ID])
  assert.deepEqual(Object.keys(campaignManifest.chaosBags), ['standard', 'hard'])
  assert.equal(campaignManifest.chaosBags.standard.filter(token => token === 'skull').length, 2)
  assert.equal(campaignManifest.chaosBags.hard.filter(token => token === 'elderthing').length, 1)
  assert.equal(campaignManifest.recordSchema.theAnomalyWasContained, 'boolean')
  assert.equal(campaignManifest.recordSchema.subject8L08DevouredTheEntireUniverse, 'boolean')
  // 开局台面：choice 节点两个分支都指向 scenario 节点（initialHubScenarioMoves 读点）。
  const nodes = campaignManifest.flow.nodes
  assert.equal(nodes[campaignManifest.flow.start].type, 'choice')
  assert.equal(nodes[campaignManifest.flow.start].options.length, 2)
  assert.deepEqual(nodes[campaignManifest.flow.start].options.map(option => option.next),
    [SCENARIO_ID, ELSE_SCENARIO_ID])
  // 普通章节数据
  assert.equal(Object.keys(LOCATIONS).length, 14, '普通 14 个地点实例（13 在场 + 1 移除位）')
  assert.equal(FIXED_LOCATION_TABLE.length, 4)
  assert.equal(QUARANTINE_TABLE.length, 10)
  assert.equal(START_LOCATION, 'temporaryHQ')
  assert.equal(ACT_CODES.length, 3)
  assert.equal(AGENDA_CODES.length, 3)
  assert.equal(STORY_CODES.length, 4)
  assert.equal(Object.keys(STORY_RULES).length, 7, '普通 4 + ELSE 3 张 Part 1 剧情')
  assert.equal(ENCOUNTER_DECK.length, 28, '初始遭遇牌库 28 张（紧噬/方体各 1 张在 afterDeckSetup 洗入）')
  assert.ok(!ENCOUNTER_DECK.includes(VULNERABLE_HEART_CODE), '脆弱心脏放一边')
  assert.ok(SET_ASIDE_ALIASES.includes(SUBJECT_CODE) === false, 'Subject 8L-08 全局放置、不占放一边')
  // ELSE 章节数据
  assert.equal(Object.keys(ELSE_LOCATIONS).length, 18)
  assert.equal(ELSE_QUARANTINE_IDS.length, 4)
  assert.ok(ELSE_SET_ASIDE_CODES.includes('89005'))
  assert.ok(ELSE_SET_ASIDE_CODES.includes('89010a'))
  assert.equal(elseChapter.manifest.requiredEncounterGroupIds[0], 'theBlobThatAteEverythingElse')
  const normalLocations = new Set(Object.keys(LOCATIONS))
  for (const id of ELSE_QUARANTINE_IDS) assert.ok(normalLocations.has(id) === false, `${id} 是 ELSE 专属地点`)
  // 指南源：中英双语且覆盖 ELSE 分支
  const guide = JSON.parse(readFileSync('content/scenario-guide-sources/theBlobThatAteEverything.json', 'utf8'))
  const elseGuide = JSON.parse(readFileSync('content/scenario-guide-sources/theBlobThatAteEverythingElse.json', 'utf8'))
  for (const source of [guide, elseGuide]) {
    for (const section of ['intro', 'setup', 'specialRules', 'story', 'resolutions']) {
      assert.ok(source.locales.en[section].length > 0, `${source.id} en.${section}`)
      assert.ok(source.locales.zh[section].length > 0, `${source.id} zh.${section}`)
      assert.deepEqual(source.locales.zh[section].map(item => item.id), source.locales.en[section].map(item => item.id))
    }
  }
  assert.ok(guide.locales.en.specialRules.some(rule => rule.id === 'elseVariant'))
  assert.ok(elseGuide.locales.zh.specialRules.some(rule => rule.id === 'replicatingAberration'))
})

function manifestRequired(chapterModule) {
  return chapterModule.manifest.requiredPackIds
}

test('吞噬万物：开局台面双入口 → 普通单桌起局（地点/Subject/反制措施/网格连接）', () => {
  if (runChild('吞噬万物：开局台面双入口')) return
  const state = createGameState({ campaignId: campaignManifest.id, campaignHub: true, difficulty: 'standard', seed: 'blob-hub' }, players)
  const opening = legalMoves(state).filter(item => item.action === 'hubSelectScenario').map(item => item.scenarioId)
  assert.deepEqual([...opening].sort(), [SCENARIO_ID, ELSE_SCENARIO_ID], '两个入口都可选')
  startScenario(state, SCENARIO_ID)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, SCENARIO_ID)
  assert.equal(state.locations.length, 13, '13 张地点入场')
  const blob = state.scenarioFlags.blob
  assert.equal(blob.elseMode, false)
  assert.equal(blob.removed.length, 1, '普通流程随机移除 1 张隔离区')
  assert.equal(blob.countermeasures, 1, '1 名调查员：1 个反制措施')
  assert.equal(state.acts[0].code, '85006')
  assert.equal(state.agendas[0].code, '85002')
  const subject = state.enemies.find(enemy => enemy.code === SUBJECT_CODE)
  assert.ok(subject, 'Subject 8L-08 在场')
  assert.equal(subject.location, null, 'Subject 不在任何地点（全局）')
  assert.equal(Number(subject.health), 15, '单桌血量 15[per_investigator]')
  assert.equal(state.investigators[0].location, START_LOCATION, '从临时总部开始')
  // 网格连接：陨石坑连 4 个内环地点；十字中心与内外环都是正交连接
  const crater = state.locations.find(location => location.id === 'theCrater')
  assert.equal(crater.connections.length, 4)
  const placed = new Set(state.locations.map(location => location.id))
  for (const location of state.locations) {
    for (const target of location.connections) assert.ok(placed.has(target), `${location.id} 的连接 ${target} 必须在场`)
  }
  // 遭遇牌库：初始 28 + Setup 洗入紧噬软泥/方体软泥各 1 = 30
  assert.equal(state.encounterDeck.length, 30)
  assert.ok(state.encounterDeck.includes('85040') && state.encounterDeck.includes('85041'))
})

test('吞噬万物：幕 1 团队线索推进 → 脆弱心脏 → 伤害双倍转移 → 轮末推进幕 2', () => {
  if (runChild('吞噬万物：幕 1 团队线索推进')) return
  const state = newStandalone(SCENARIO_ID, 'blob-act1')
  const inv = state.investigators[0]
  inv.clues = 4
  move(state, { action: 'scenarioAction', rule: 'blobAdvanceAct1', locationId: inv.location })
  settle(state, pending => (pending.kind === 'location' ? pending.options[0]?.id : null))
  assert.equal(state.actIndex, 1, '幕 1 推进到幕 2（外星生理学）')
  assert.equal(state.acts[1].code, '85007')
  const heart = state.enemies.find(enemy => enemy.code === VULNERABLE_HEART_CODE)
  assert.ok(heart, '幕 1 背面：脆弱心脏在[[软泥污染]]地点生成')
  assert.ok(LOCATIONS[heart.location]?.oozified, '脆弱心脏生成在软泥污染地点')
  const subject = state.enemies.find(enemy => enemy.code === SUBJECT_CODE)
  const before = Number(subject.damageTaken) || 0
  transact(state, draft => damageEnemy(draft, draft.enemies.find(enemy => enemy.code === VULNERABLE_HEART_CODE), 2, 0, []))
  const subjectAfter = state.enemies.find(enemy => enemy.code === SUBJECT_CODE)
  const heartAfter = state.enemies.find(enemy => enemy.code === VULNERABLE_HEART_CODE)
  assert.ok(heartAfter.damageTaken >= 2, '心脏受到 2 点伤害')
  assert.equal((Number(subjectAfter.damageTaken) || 0) - before, 4, '心脏每受 1 点伤害 → Subject 受到 2 点')
  // 幕 2：轮末强制推进（behavior.roundEnded 记账 → checkObjectives 兑现）
  const blob = state.scenarioFlags.blob
  blob.pendingActAdvance = true
  move(state, { action: 'endTurn' })
  settle(state)
  for (const action of ['hubContinue', 'draw', 'endTurn']) {
    if (state.pendingChoice) break
    const available = legalMoves(state).some(item => item.action === action)
    if (!available) break
    move(state, { action })
    settle(state)
  }
  assert.ok(state.actIndex >= 2 || state.uiState !== 'inScenario', '幕 2 在轮末/下一步推进')
})

test('吞噬万物：幕 3 背面读取 Part 1 剧情并重置幕牌库', () => {
  if (runChild('吞噬万物：幕 3 背面读取')) return
  const state = newStandalone(SCENARIO_ID, 'blob-act3')
  state.actIndex = 2
  settle(state)
  transact(state, draft => advanceAct(draft, []))
  assert.equal(state.acts[0].code, '85006', '幕牌库重置回幕 1')
  assert.equal(state.actIndex, 0, '幕指针回到第 1 幕')
  const blob = state.scenarioFlags.blob
  assert.ok(blob.story, '读取了一张 Part 1 剧情')
  assert.ok(STORY_CODES.includes(blob.story.code), '普通流程只会读取 85021–85024')
  assert.equal(blob.cycle, 1, '循环计数 +1')
  assert.ok((blob.usedStories || []).includes(blob.story.code))
})

test('吞噬万物：击败个体代号8L-08 → 结局 2 → 记录/奖励 → 关间决策 → 战役结束', () => {
  if (runChild('吞噬万物：击败个体代号8L-08')) return
  const state = newStandalone(SCENARIO_ID, 'blob-r2')
  const subject = state.enemies.find(enemy => enemy.code === SUBJECT_CODE)
  transact(state, draft => damageEnemy(draft, draft.enemies.find(enemy => enemy.code === SUBJECT_CODE),
    Number(subject.health) || 15, 0, []))
  settle(state, pending => (pending.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult', '进入剧本结算')
  assert.equal(state.resolution, 'resolution2')
  assert.equal(state.campaign.records.theAnomalyWasContained, true, '记录「异变体已被收容」')
  move(state, { action: 'hubContinue' })
  settle(state)
  assert.ok(state.pendingChoice, '关间决策节点')
  const ids = state.pendingChoice.options.map(option => option.id)
  assert.ok(ids.includes('recordedAnomalyContained'), `决策项 ${ids.join(',')}`)
  assert.ok(ids.includes('elseVariant'), '普通流程 R2 后可进入 ELSE! 变体（returnToVariant 入口）')
  settle(state, () => 'recordedAnomalyContained')
  assert.equal(state.uiState, 'campaignResult', '战役结束')
})

test('吞噬万物：普通流程 R2 → ELSE! 变体入口 → 变体起局并写入 elsePlayed 记录', () => {
  if (runChild('吞噬万物：普通流程 R2 → ELSE')) return
  const state = newStandalone(SCENARIO_ID, 'blob-r2-else')
  const subject = state.enemies.find(enemy => enemy.code === SUBJECT_CODE)
  transact(state, draft => damageEnemy(draft, draft.enemies.find(enemy => enemy.code === SUBJECT_CODE),
    Number(subject.health) || 15, 0, []))
  settle(state, pending => (pending.kind === 'storyCard' ? 'skip' : null))
  assert.equal(state.uiState, 'scenarioResult')
  move(state, { action: 'hubContinue' })
  settle(state)
  const ids = state.pendingChoice.options.map(option => option.id)
  assert.ok(ids.includes('elseVariant'))
  settle(state, () => 'elseVariant')
  move(state, { action: 'hubBeginScenario' })
  settle(state)
  assert.equal(state.scenario.id, ELSE_SCENARIO_ID, '进入 ELSE! 变体关卡')
  assert.equal(state.campaign.records.elsePlayed, true, '记录 elsePlayed')
  assert.equal(state.scenarioFlags.blob.elseMode, true)
})

test('吞噬万物 ELSE!：变体起局、主街连接、复制异变体与现实酸液近似', () => {
  if (runChild('吞噬万物 ELSE!：变体起局')) return
  const state = newStandalone(ELSE_SCENARIO_ID, 'blob-else')
  assert.equal(state.scenario.id, ELSE_SCENARIO_ID)
  const blob = state.scenarioFlags.blob
  assert.equal(blob.elseMode, true, 'ELSE! 模式')
  assert.equal(blob.removed.length, 5, '14 张隔离区中随机移除 5 张')
  assert.equal(state.locations.length, 13)
  assert.equal(state.encounterDeck.length, 30)
  // 场上地点来自普通 + ELSE 池；ELSE 地点可能随机被移除，但数据池必须存在。
  const allIds = new Set(LOCATION_TABLE.map(([id]) => id).concat(ELSE_QUARANTINE_IDS))
  for (const location of state.locations) assert.ok(allIds.has(location.id), `未知地点 ${location.id}`)
  assert.ok(state.scenario.id === ELSE_SCENARIO_ID)
  const setAside = state.scenarioZones?.setAside || []
  for (const code of ['89005', '89010a', '89011', '89012', '89013', '89019']) {
    assert.ok(setAside.includes(code), `ELSE 放一边包含 ${code}`)
  }
  // 主街连接（若主街在场）：与每张在场粘稠街道互相连接。
  const mainStreet = state.locations.find(location => location.id === 'mainStreet')
  const slimy = state.locations.filter(location => /^slimyStreets/.test(location.id))
  if (mainStreet && slimy.length) {
    for (const streets of slimy) {
      assert.ok(mainStreet.connections.includes(streets.id), '主街→粘稠街道连接')
      assert.ok(streets.connections.includes('mainStreet'), '粘稠街道→主街连接')
    }
  }
  // 复制异变体：击败一名[[异质]]敌人（Oozeling）→ 队长选择阻止/允许 → 生成 89010x。
  const aberrationDefaults = state.enemies.length
  const oozeling = state.enemies.find(enemy => enemy.code === '85039')
  if (oozeling) {
    settle(state, pending => {
      if (pending.prompt?.includes('复制')) return pending.options.find(option => option.id === 'allow')?.id
      return null
    })
    transact(state, draft => damageEnemy(draft, draft.enemies.find(enemy => enemy.id === oozeling.id), 10, 0, []),
      pending => (pending.prompt?.includes('复制') ? pending.options.find(option => option.id === 'allow')?.id : null))
    const aberrations = state.enemies.filter(enemy => /^89010/.test(enemy.code))
    assert.ok(aberrations.length >= 1 || state.enemies.length >= aberrationDefaults, '复制判定至少执行')
  }
  // 现实酸液（ELSE）：behavior.resolveEncounterCard 近似结算并返回 true。
  const messages = []
  const handled = elseChapter.behavior.resolveEncounterCard(state, state.investigators[0], '85044', {
    info: text => messages.push(text), random: () => 0.2,
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
    damage: () => {}, horror: () => {}, loseResources: () => {}, addBasicWeakness: () => {},
  })
  assert.equal(handled, true, '85044 在 ELSE! 下走 89005 图表')
  assert.ok(messages.some(text => text.includes('现实酸液')), '现实酸液日志')
})

test('吞噬万物：混乱标记数值与存档 JSON 往返', () => {
  if (runChild('吞噬万物：混乱标记数值')) return
  const state = newStandalone(SCENARIO_ID, 'blob-tokens')
  settle(state)
  const blob = state.scenarioFlags.blob
  blob.devoured = 10
  const token = chapter.behavior.resolveChaosToken(state, state.investigators[0], 'skull')
  assert.equal(token.delta, -2, '普通：每 5 张吞噬 -1')
  state.difficulty = 'hard'
  const hardToken = chapter.behavior.resolveChaosToken(state, state.investigators[0], 'skull')
  assert.equal(hardToken.delta, -3, '困难：每 3 张吞噬 -1')
  state.difficulty = 'standard'
  blob.devoured = 0
  assert.equal(chapter.behavior.resolveChaosToken(state, state.investigators[0], 'cultist').delta, -2)
  assert.equal(chapter.behavior.resolveChaosToken(state, state.investigators[0], 'tablet').delta, -3)
  assert.equal(chapter.behavior.resolveChaosToken(state, state.investigators[0], 'elderthing').delta, -5)
  // 存档往返：地点网格、幕/议程、剧情标记、遭遇牌库顺序都保留。
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.locations.map(location => location.id), state.locations.map(location => location.id))
  assert.deepEqual(restored.acts.map(act => act.code), state.acts.map(act => act.code))
  assert.deepEqual(restored.scenarioFlags.blob.slots, state.scenarioFlags.blob.slots)
  assert.deepEqual(restored.encounterDeck, state.encounterDeck)
  assert.equal(restored.investigators[0].location, state.investigators[0].location)
  // 读档后仍可继续操作
  const before = restored.investigators[0].resources
  move(restored, { action: 'resource' })
  assert.equal(restored.investigators[0].resources, before + 1)
})
