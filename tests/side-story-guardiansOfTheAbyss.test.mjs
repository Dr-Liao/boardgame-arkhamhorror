// 批次 4 · Beta 支线验收：深渊守卫（Guardians of the Abyss · 83001 + 83016）。
//
// 覆盖：
//   A. 战役/章节数据形状（双章 manifest、两套混乱袋、遭遇组、放一边、探索牌库、符号连接地点）；
//   B. 第一章独立开局（真实引擎）：6 张地点入场、深渊之力 = 调查员人数、兄弟会 6 名在参考卡下方、
//      遭遇牌库 30 张、Standard 袋 21 枚；
//   C. 第一章完整推进（真实引擎）：6 张证据 → 幕 1 背面建探索牌库 → 7 张探险地点 → 幕 2 背面
//      放沉梦者并生成奈斯 → 击败奈斯 → 幕 3 背面二选一 → 结局 1 记录 → 关间奖励选择；
//   D. 跨章：结局记录携带到《夜之篡位者》→ 深渊之力 = dreamersInTheAbyss、参考卡下方 = 逃脱的
//      兄弟会特工、探索牌库 11 张；第二章推进到结局 2 并领取召唤夜魇 → 支线结束；
//   E. 混乱标记取值（两章 [skull]/[tablet]/[elder_thing]）与 tokenMeanings；
//   F. 存档 JSON 往返（章节标记/深渊之力/兄弟会/探索牌库）；
//   G. 冒险指南源：两章 + 战役三级 id/campaignId、中英分支一致、结局 id 覆盖 resolutionIds。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { currentContentBundle, registerContentBundle } from '../content/registered.js'
import { manifest as campaignManifest, CHAOS_BAGS } from '../content/campaigns/guardiansOfTheAbyss/manifest.js'
import * as ch1 from '../content/campaigns/guardiansOfTheAbyss/scenarios/theEternalSlumber/index.js'
import * as ch2 from '../content/campaigns/guardiansOfTheAbyss/scenarios/theNightsUsurper/index.js'
import {
  BROTHERHOOD_ENEMY_CODES, BROTHERHOOD_STORY_CODES,
} from '../content/campaigns/guardiansOfTheAbyss/shared.js'
import * as ch1Definition from '../content/campaigns/guardiansOfTheAbyss/scenarios/theEternalSlumber/definition.js'
import * as ch2Definition from '../content/campaigns/guardiansOfTheAbyss/scenarios/theNightsUsurper/definition.js'
import { createGameState, applyMove } from '../src/engine/engine.js'
import { move, settle, decisionSeat } from './core-fixture.mjs'
import { driveHub, players } from './side-story-harness.mjs'
import { buildAuthoredScenarioGuide } from '../tools/authored-scenario-guide.mjs'

if (!currentContentBundle().campaigns.some(item => item.id === campaignManifest.id)) {
  registerContentBundle({ campaigns: [campaignManifest], scenarios: [ch1, ch2] })
}

const CHOICE_DEFAULTS = ['done', 'skip', 'keep', 'self', 'continue']
function answerAll(state, pick = () => null) {
  for (let guard = 0; state.pendingChoice && guard < 120; guard += 1) {
    const choice = state.pendingChoice
    const optionId = pick(choice)
      ?? CHOICE_DEFAULTS.find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    const seat = choice.seat ?? decisionSeat(state) ?? 0
    applyMove(state, seat, { action: 'choose', choiceId: choice.id, optionId })
  }
}
function answerUntilCampaignBranch(state) {
  for (let guard = 0; state.pendingChoice && state.pendingChoice.kind !== 'campaignBranch' && guard < 80; guard += 1) {
    const choice = state.pendingChoice
    const optionId = CHOICE_DEFAULTS.find(id => choice.options.some(option => option.id === id)) ?? choice.options[0].id
    applyMove(state, choice.seat ?? decisionSeat(state) ?? 0, { action: 'choose', choiceId: choice.id, optionId })
  }
}
function startCampaign(seed = 'guardians-test') {
  const state = createGameState({ campaignId: 'guardiansOfTheAbyss', campaignHub: true, difficulty: 'standard', seed }, players)
  driveHub(state, { investigator: '01002' })
  return state
}
function advanceAct1ByEvidence(state) {
  state.scenarioFlags.guardians.evidence = BROTHERHOOD_STORY_CODES.slice(0, 6)
  move(state, { action: 'draw' })
  answerAll(state)
}
function placeExpeditionLocations(state, locations, ids) {
  for (const id of ids) {
    if (!state.locations.some(location => location.id === id)) {
      state.locations.push({ ...structuredClone(locations[id]), clues: 0, revealed: true })
    }
  }
}

test('深渊守卫：战役与双章数据形状', () => {
  const bundle = currentContentBundle()
  const packs = new Map(bundle.packs.map(pack => [pack.id, pack]))
  assert.ok(packs.has('guardiansCampaign'), 'guardiansCampaign 包已注册')
  assert.deepEqual(packs.get('guardiansCampaign').encounterGroupIds, ['theEternalSlumber', 'theNightsUsurper'])
  assert.deepEqual([...campaignManifest.requiredPackIds], ['core', 'guardiansCampaign'])
  assert.deepEqual([...campaignManifest.scenarioIds], ['theEternalSlumber', 'theNightsUsurper'])
  assert.equal(campaignManifest.opening.experience, 2, '独立开局经验 = side-stories.json xp 2')
  assert.deepEqual(Object.keys(campaignManifest.chaosBags), ['standard', 'hard'])
  assert.equal(CHAOS_BAGS.standard.length, 21, 'Standard 袋 21 枚')
  assert.equal(CHAOS_BAGS.hard.length, 23, 'Hard 袋 23 枚')
  assert.equal(CHAOS_BAGS.standard.filter(token => token === 'skull').length, 3)
  assert.equal(CHAOS_BAGS.hard.filter(token => token === 'elderthing').length, 1)
  for (const key of ['theCurseOfSlumberWasLifted', 'youAreAwareOfXzharahsPlans', 'theDayOfReckoningIsComing',
    'theAbyssWasSaved', 'youJoinedForcesWithXzharah', 'theBrotherhoodsSchemesContinueUnabated']) {
    assert.equal(campaignManifest.recordSchema[key], 'boolean', `记录 ${key}`)
  }
  assert.equal(campaignManifest.recordSchema.dreamersInTheAbyss, 'number')
  assert.equal(campaignManifest.recordSchema.brotherhoodAgentsWhoEscaped, 'string[]')
  for (const id of ['slumberReward', 'usurperReward']) {
    assert.equal(campaignManifest.flow.nodes[id].type, 'choice', `关间决策节点 ${id}`)
  }
  assert.equal(campaignManifest.flow.nodes[campaignManifest.flow.start].next, 'slumberReward')

  // 第一章：13 张地点（含 7 张探险）、30 张初始遭遇牌库、12 张探索牌库。
  assert.equal(Object.keys(ch1.scenario.locations).length, 13)
  assert.equal(ch1Definition.CAIRO_LOCATION_IDS.length, 5)
  assert.equal(ch1Definition.EXPEDITION_LOCATION_IDS.length, 7)
  assert.equal(ch1.ENCOUNTER_DECK.length, 30)
  assert.equal(ch1Definition.EXPLORATION_DECK.length, 12)
  assert.equal(ch1Definition.BROTHERHOOD_ENEMY_CODES.length, 6)
  assert.equal(ch1Definition.BROTHERHOOD_STORY_CODES.length, 6)
  assert.ok(ch1Definition.SET_ASIDE_ALIASES.includes('83013'), '奈斯放一边')
  assert.ok(ch1Definition.SET_ASIDE_ALIASES.includes('83055'), '约翰和杰西放一边')
  assert.ok(ch1Definition.SET_ASIDE_ALIASES.includes('83056'), '古老圣甲虫护符放一边')
  // 位面符号连接：开罗街道（equals）连到开罗集市（square）与博物馆（triangle）。
  assert.ok(ch1.scenario.locations.streetsOfCairo.connections.includes('cairoBazaar'))
  assert.ok(ch1.scenario.locations.outskirtsOfCairo.connections.includes('expeditionCamp'))

  // 第二章：14 张地点（超凡之门 + 5 张异界）、27 张初始遭遇牌库、11 张探索牌库。
  assert.equal(Object.keys(ch2.scenario.locations).length, 14)
  assert.equal(ch2.ENCOUNTER_DECK.length, 27)
  assert.equal(ch2Definition.EXPLORATION_DECK.length, 11)
  assert.ok(ch2Definition.SET_ASIDE_ALIASES.includes('83027a'), '伊扎法拉放一边')
  assert.ok(ch2Definition.SET_ASIDE_ALIASES.includes('83028'), '超凡之门放一边')
  assert.equal(ch2Definition.OTHERWORLD_LOCATION_IDS.length, 5)
  assert.equal(ch2Definition.OTHERWORLD_STORY_CODES.length, 5)
  assert.ok(ch2.scenario.locations.theGreatAbyss.connections.includes('aDreamBetwixt'))
})

test('深渊守卫：第一章独立开局（真实引擎）', () => {
  const state = startCampaign('guardians-setup')
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'theEternalSlumber')
  assert.equal(state.investigators[0].location, 'streetsOfCairo')
  assert.deepEqual(state.locations.map(location => location.id).sort(),
    ['cairoBazaar', 'expeditionCamp', 'museumOfEgyptianAntiquities', 'outskirtsOfCairo', 'streetsOfCairo', 'templeCourtyard'].sort())
  const streets = state.locations.find(location => location.id === 'streetsOfCairo')
  assert.equal(streets.clues, 2, '开罗街道 2[per_investigator] 线索（1P = 2）')
  assert.equal(state.encounterDeck.length, 30)
  assert.deepEqual([...state.chaosBag].sort(), [...CHAOS_BAGS.standard].sort())
  assert.equal(state.acts[state.actIndex].code, '83005')
  assert.equal(state.agendas[state.agendaIndex].code, '83002')
  assert.equal(state.agendas[state.agendaIndex].doomThreshold, 7, '议程毁灭阈值 7（1P）')
  const flags = state.scenarioFlags.guardians
  assert.equal(flags.strength, 1, '深渊之力 = 调查员人数（独立模式）')
  assert.deepEqual([...flags.brotherhood].sort(), [...BROTHERHOOD_ENEMY_CODES].sort(), '6 名兄弟会特工在参考卡下方')
  assert.deepEqual(state.scenarioZones.setAsideLocations.sort(), [...ch1Definition.EXPEDITION_LOCATION_IDS].sort())
  assert.equal(legalExploreAvailable(state), false, '幕 1 未揭示背面时没有探索牌库')
})

function legalExploreAvailable(state) {
  return Boolean(state.explorationDeck?.length)
}

test('深渊守卫：第一章幕 1→幕 3 → 结局 1 与关间奖励（真实引擎）', () => {
  const state = startCampaign('guardians-ch1')
  advanceAct1ByEvidence(state)
  assert.equal(state.actIndex, 1, '6 张证据推进幕 1')
  assert.equal(state.acts[state.actIndex].code, '83006')
  assert.equal(state.explorationDeck.length, 12, '幕 1 背面建立 12 张探索牌库')
  assert.equal(state.investigators[0].clues, 0, '幕 1 背面全员失去线索')
  // 幕 2：7 张探险地点全部入场后推进。
  placeExpeditionLocations(state, ch1.scenario.locations, ch1Definition.EXPEDITION_LOCATION_IDS)
  move(state, { action: 'draw' })
  answerAll(state)
  assert.equal(state.actIndex, 2, '7 张探险地点推进幕 2')
  assert.equal(state.acts[state.actIndex].code, '83007')
  assert.ok(state.enemies.some(enemy => enemy.code === '83013'), '幕 2 背面生成奈斯')
  for (const id of ch1Definition.CAIRO_LOCATION_IDS) {
    const here = state.locations.find(location => location.id === id)
    assert.equal(here?.dreamers, 1, `${id} 放置 1 个沉梦者（1P）`)
  }
  // 幕 3：奈斯被击败 → 背面二选一 → 结局 1。
  state.enemies = state.enemies.filter(enemy => enemy.code !== '83013')
  move(state, { action: 'draw' })
  answerAll(state, choice => (String(choice.prompt || '').includes('消灭') ? 'destroy' : null))
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.resolution, 'resolution1')
  assert.equal(state.campaign.records.theCurseOfSlumberWasLifted, true)
  assert.equal(state.campaign.records.dreamersInTheAbyss, 1, '记录 dreamersInTheAbyss = 深渊之力')
  assert.ok(state.campaign.records.brotherhoodAgentsWhoEscaped.length >= 6, '记录逃脱的兄弟会特工')
  // 关间奖励：结局 1 提供约翰和杰西·伯克。
  move(state, { action: 'hubContinue' })
  answerUntilCampaignBranch(state)
  assert.ok(state.pendingChoice, '关间奖励是决策节点')
  const options = state.pendingChoice.options.map(option => option.id)
  assert.deepEqual(options.sort(), ['addJohnAndJessie', 'continue'], '结局 1 只出现对应奖励 + 继续')
  answerAll(state, choice => (choice.options.some(option => option.id === 'addJohnAndJessie') ? 'addJohnAndJessie' : null))
  assert.equal(state.uiState, 'scenarioSetup', '关间奖励后进入第二章准备')
  assert.equal(state.hubSelectedScenarioId, 'theNightsUsurper')
  assert.ok(state.campaign.investigators[0].deck.includes('83055'), '约翰和杰西·伯克加入牌组（不计张数）')
})

test('深渊守卫：第二章按第一章记录初始化（真实引擎）', () => {
  const state = startCampaign('guardians-ch2-setup')
  advanceAct1ByEvidence(state)
  placeExpeditionLocations(state, ch1.scenario.locations, ch1Definition.EXPEDITION_LOCATION_IDS)
  move(state, { action: 'draw' })
  answerAll(state)
  state.enemies = state.enemies.filter(enemy => enemy.code !== '83013')
  move(state, { action: 'draw' })
  answerAll(state, choice => (String(choice.prompt || '').includes('消灭') ? 'destroy' : null))
  move(state, { action: 'hubContinue' })
  answerUntilCampaignBranch(state)
  answerAll(state, choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  move(state, { action: 'hubBeginScenario' })
  answerAll(state)
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'theNightsUsurper')
  assert.equal(state.investigators[0].location, 'expeditionCamp')
  assert.equal(state.locations.length, 1, '第二章开场只有探险营地')
  assert.equal(state.explorationDeck.length, 11, '第二章探索牌库 11 张')
  assert.equal(state.encounterDeck.length, 27)
  const flags = state.scenarioFlags.guardians
  assert.equal(flags.strength, state.campaign.records.dreamersInTheAbyss, '深渊之力 = dreamersInTheAbyss')
  assert.ok(flags.brotherhood.length >= 1, '参考卡下方 = 逃脱的兄弟会特工')
  for (const code of flags.brotherhood) assert.ok(BROTHERHOOD_ENEMY_CODES.includes(code))
})

test('深渊守卫：第二章幕 1→结局 2 并领取召唤夜魇（真实引擎）', () => {
  const state = startCampaign('guardians-ch2-run')
  advanceAct1ByEvidence(state)
  placeExpeditionLocations(state, ch1.scenario.locations, ch1Definition.EXPEDITION_LOCATION_IDS)
  move(state, { action: 'draw' })
  answerAll(state)
  state.enemies = state.enemies.filter(enemy => enemy.code !== '83013')
  move(state, { action: 'draw' })
  answerAll(state, choice => (String(choice.prompt || '').includes('消灭') ? 'destroy' : null))
  move(state, { action: 'hubContinue' })
  answerUntilCampaignBranch(state)
  answerAll(state, choice => (choice.options.some(option => option.id === 'continue') ? 'continue' : null))
  move(state, { action: 'hubBeginScenario' })
  answerAll(state)
  // 幕 1：7 张探险地点入场 → 背面把超凡之门洗入探索牌库。
  placeExpeditionLocations(state, ch2.scenario.locations, ch2Definition.EXPEDITION_LOCATION_IDS)
  move(state, { action: 'draw' })
  answerAll(state)
  assert.equal(state.actIndex, 1)
  assert.equal(state.acts[state.actIndex].code, '83020')
  assert.ok(state.explorationDeck.includes('eldritchGate'), '超凡之门洗入探索牌库')
  // 幕 2：全员在超凡之门并支付 3[per_investigator] 线索（Act 2b perPlayer 3）→ 背面进入梦境之间并生成伊扎法拉。
  state.locations.push({ ...structuredClone(ch2.scenario.locations.eldritchGate), clues: 0, revealed: true })
  state.investigators[0].location = 'eldritchGate'
  state.investigators[0].clues = 3
  move(state, { action: 'draw' })
  answerAll(state)
  assert.equal(state.actIndex, 2, '支付线索进入门')
  assert.deepEqual(state.locations.map(location => location.id), ['aDreamBetwixt'], '其余地点移出游戏')
  assert.equal(state.investigators[0].location, 'aDreamBetwixt')
  const xzharah = state.enemies.find(enemy => enemy.code === '83027a')
  assert.ok(xzharah, '伊扎法拉现身')
  // 幕 3：满足 3 项条件（击败/耗尽 + 3 线索 + 深渊之力 ≤4 + 三条记忆）→ 结局 2。
  xzharah.damageTaken = xzharah.health
  xzharah.exhausted = true
  state.investigators[0].clues = 3
  state.scenarioFlags.guardians.remembered = {
    freedTheNightgaunts: true, executedTheNightgaunts: false,
    warnedTheDenizensOfSarkomand: true, cutOffAllEscape: false,
    pledForHelp: true, affrontedTheRulerOfThisRealm: false,
  }
  move(state, { action: 'draw' })
  answerAll(state)
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.resolution, 'resolution2')
  assert.equal(state.campaign.records.theAbyssWasSaved, true)
  // 关间奖励：结局 2 提供召唤夜魇；领取后支线结束。
  move(state, { action: 'hubContinue' })
  answerUntilCampaignBranch(state)
  assert.ok(state.pendingChoice, '第二章关间奖励是决策节点')
  const options = state.pendingChoice.options.map(option => option.id)
  assert.deepEqual(options.sort(), ['addSummonedNightgaunt', 'continue'])
  answerAll(state, choice => (choice.options.some(option => option.id === 'addSummonedNightgaunt') ? 'addSummonedNightgaunt' : null))
  assert.equal(state.uiState, 'campaignResult', '支线结束')
  assert.ok(state.campaign.investigators[0].deck.includes('83058'), '召唤夜魇加入牌组')
})

test('深渊守卫：混乱标记取值与 tokenMeanings', () => {
  const base = { difficulty: 'standard', numInvestigators: 1, investigators: [{ seat: 0, name: '测试', clues: 0 }],
    scenarioFlags: { guardians: { setup: true, strength: 3 } } }
  // 第一章：skull = -X；tablet 0（无视正面修正）；elder_thing -5；hard 各 +1/-2/-6。
  assert.equal(ch1.behavior.resolveChaosToken(base, base.investigators[0], 'skull').delta, -3)
  assert.equal(ch1.behavior.resolveChaosToken(base, base.investigators[0], 'tablet').delta, 0)
  assert.equal(ch1.behavior.resolveChaosToken(base, base.investigators[0], 'elderthing').delta, -5)
  const hard = { ...base, difficulty: 'hard' }
  assert.equal(ch1.behavior.resolveChaosToken(hard, hard.investigators[0], 'skull').delta, -4)
  assert.equal(ch1.behavior.resolveChaosToken(hard, hard.investigators[0], 'tablet').delta, -2)
  assert.equal(ch1.behavior.resolveChaosToken(hard, hard.investigators[0], 'elderthing').delta, -6)
  // 第二章：tablet -1/-3；elder_thing -4/-5（成功且深渊之力 ≥4 时 -1）。
  assert.equal(ch2.behavior.resolveChaosToken(base, base.investigators[0], 'tablet').delta, -1)
  assert.equal(ch2.behavior.resolveChaosToken(hard, hard.investigators[0], 'tablet').delta, -3)
  assert.equal(ch2.behavior.resolveChaosToken(base, base.investigators[0], 'elderthing').delta, -4)
  assert.equal(ch2.behavior.resolveChaosToken(hard, hard.investigators[0], 'elderthing').delta, -5)
  const tokens1 = ch1.behavior.tokenMeanings()
  const tokens2 = ch2.behavior.tokenMeanings()
  for (const bag of ['standard', 'hard']) {
    for (const face of ['skull', 'cultist', 'tablet', 'elderthing']) {
      assert.ok(tokens1[bag][face]?.text, `第一章标记 ${bag}/${face}`)
      assert.ok(tokens2[bag][face]?.text, `第二章标记 ${bag}/${face}`)
    }
  }
  // 议程背面：深渊之力 +1；第二章议程 2 背面 → 结局 1。
  const state = startCampaign('guardians-agenda')
  const current = state.scenarioFlags.guardians.strength
  const stub = { calls: {}, info: () => {}, advanceAct: () => { stub.calls.advanceAct = true },
    shuffle: list => [...list] }
  ch1.behavior.agendaReveal(state, { code: '83002' }, stub)
  assert.equal(state.scenarioFlags.guardians.strength, current + 1, '议程 1 背面深渊之力 +1')
  assert.equal(state.encounterDeck.filter(code => code === '83045').length > 2, true, '洗入 2 张深渊亡魂')
  assert.equal(stub.calls.advanceAct, true, '幕 1 时议程 1 背面推进幕')
  const stub2 = { calls: {}, info: () => {}, finish: key => { stub2.calls.finish = key } }
  ch2.behavior.agendaReveal(state, { code: '83018' }, stub2)
  assert.equal(stub2.calls.finish, 'resolution1', '第二章议程 2 背面 → 结局 1')
})

test('深渊守卫：存档 JSON 往返（章节标记/深渊之力/兄弟会/探索牌库）', () => {
  const state = startCampaign('guardians-save')
  advanceAct1ByEvidence(state)
  assert.equal(state.actIndex, 1)
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(restored.scenario.id, 'theEternalSlumber')
  assert.equal(restored.scenarioFlags.guardians.strength, 1)
  assert.equal(restored.scenarioFlags.guardians.evidence.length, 6)
  assert.equal(restored.scenarioFlags.guardians.brotherhood.length, 6)
  assert.equal(restored.explorationDeck.length, 12)
  assert.deepEqual(restored.locations.map(location => location.id).sort(), state.locations.map(location => location.id).sort())
  // 恢复后的纯数据可继续驱动行为（不依赖运行时对象）。
  const summary = ch1.behavior.scenarioSummary(restored)
  assert.equal(summary.act, '83006')
  assert.equal(summary.explorationDeck.length, 12)
  ch1.behavior.checkObjectives(restored, { info: () => {} })
  assert.equal(restored.actIndex, 1, '未集齐 7 张探险地点时不推进幕 2')
})

test('深渊守卫：冒险指南源（战役 + 两章、中英分支一致、结局覆盖）', () => {
  const read = name => JSON.parse(readFileSync(new URL(`../content/scenario-guide-sources/${name}.json`, import.meta.url), 'utf8'))
  const campaignSource = read('guardiansOfTheAbyss')
  assert.equal(campaignSource.id, 'guardiansOfTheAbyss')
  assert.equal(campaignSource.campaignId, 'guardiansOfTheAbyss')
  assert.deepEqual(Object.keys(campaignSource.locales).sort(), ['en', 'zh'])
  for (const [name, manifest] of [['theEternalSlumber', ch1.manifest], ['theNightsUsurper', ch2.manifest]]) {
    const source = read(name)
    assert.equal(source.id, name)
    assert.equal(source.campaignId, 'guardiansOfTheAbyss')
    const guide = buildAuthoredScenarioGuide(manifest, source)
    assert.deepEqual(Object.keys(guide.locales).sort(), ['en', 'zh'])
    for (const language of ['en', 'zh']) {
      const sections = guide.locales[language]
      assert.ok(sections.setup.length >= 3, `${name}/${language} 设置步骤`)
      assert.ok(sections.resolutions.length >= manifest.resolutionIds.length, `${name}/${language} 结局`)
      assert.equal(sections.resolutions[0].id, manifest.resolutionIds[0])
      for (const text of Object.values(sections).flatMap(blocks => blocks.flatMap(block => [
        block.text, block.title, ...(block.children || []).flatMap(child => [child.text, child.title]),
      ])).filter(Boolean)) {
        assert.doesNotMatch(text, /<\/?[a-z][^>]*>/i, `${name}/${language} 不得残留 HTML`)
        assert.doesNotMatch(text, /@:[\w.]+/, `${name}/${language} 不得残留未展开标记`)
      }
    }
    assert.deepEqual(
      guide.locales.zh.resolutions.map(block => block.id).sort(),
      guide.locales.en.resolutions.map(block => block.id).sort(),
      `${name} 中英结局分支一致`,
    )
  }
})
