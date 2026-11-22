// 重返夜之狂热（returnToNightOfTheZealot）三章 · 引擎集成测试。
//
// 覆盖：
//   1. 章节模块/manifest 通过注册期契约；
//   2. 真实 createGameState + startScenario 开局布置（起点/地点/幕/密谋/遭遇牌库/放一边区）；
//   3. 幕/密谋推进：RtG 幕 1 背面放墙上的洞并揭示；幕 2 背面放客厅/丽塔/食尸鬼祭司；
//      幕 3 击败食尸鬼祭司 → 结局选择 → 结局记录；
//   4. 结局记录与奖励：RtG r1 记录 houseBurned/ghoulPriestAlive；RtMM r2 记录 pastMidnight；
//   5. JSON 存档往返（migrateState）后视图/合法行动/再执行一次动作的结果一致。
//
// 运行：node --test tests/ret-notz.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync as readGuideFile } from 'node:fs'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import {
  createGameState, startScenario, advanceAct, advanceAgenda, finishScenario, applyMove,
  legalMoves, scenarioRuntime,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { migrateState } from '../src/engine/save-migration.js'
import { viewState } from '../src/integration/observation.js'
import * as gathering from '../content/campaigns/returnToNightOfTheZealot/scenarios/returnToTheGathering/index.js'
import * as masks from '../content/campaigns/returnToNightOfTheZealot/scenarios/returnToTheMidnightMasks/index.js'

const CAMPAIGN_ID = 'returnToNightOfTheZealot'
const CHAPTERS = [gathering, masks]
// RtDB 由主进程并行编写：存在即自动纳入注册与用例，不存在则跳过。
let devourer = null
try {
  devourer = await import('../content/campaigns/returnToNightOfTheZealot/scenarios/returnToTheDevourerBelow/index.js')
  CHAPTERS.push(devourer)
} catch (error) {
  if (!/Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(error?.code || error?.message))) throw error
}

const inTransaction = (state, run) => resolveTransaction(state, 0, { action: 'ret-notz-test' }, draft => run(draft))

const settle = state => {
  for (let i = 0; state.pendingChoice && i < 200; i += 1) {
    const choice = state.pendingChoice
    const option = choice.options.find(item => ['done', 'skip', 'self'].includes(item.id)) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  return state
}

function localCampaign(scenarioIds) {
  const template = contentRegistry.getCampaign('nightOfTheZealot')
  return {
    ...structuredClone(template),
    id: CAMPAIGN_ID,
    name: '重返夜之狂热',
    nameEn: 'Return to the Night of the Zealot',
    requiredPackIds: ['core', 'notz', 'rtnotzCampaign'],
    scenarioIds,
    unlock: Object.fromEntries(scenarioIds.map((id, index) => [id, scenarioIds.slice(0, index)])),
    flow: {
      start: scenarioIds[0],
      nodes: Object.fromEntries([
        ...scenarioIds.map((id, index) => [id, {
          type: 'scenario', scenarioId: id,
          next: scenarioIds[index + 1] || 'end',
        }]),
        ['end', { type: 'end' }],
      ]),
    },
  }
}

function chaptersNotRegistered() {
  const missing = CHAPTERS.filter(chapter => {
    try { contentRegistry.getScenario(chapter.manifest.id); return false } catch { return true }
  })
  if (!contentRegistry.getCampaign(CAMPAIGN_ID) && missing.length) {
    registerContentBundle({
      campaigns: [localCampaign(missing.map(chapter => chapter.manifest.id))],
      scenarios: missing,
    })
  } else if (missing.length) {
    registerContentBundle({ scenarios: missing })
  }
  return missing
}

chaptersNotRegistered()
const SCENARIO_IDS = [...(contentRegistry.getCampaign(CAMPAIGN_ID)?.scenarioIds || CHAPTERS.map(chapter => chapter.manifest.id))]
const indexOf = id => SCENARIO_IDS.indexOf(id)

function newGame(seed) {
  const game = createGameState({ campaignId: CAMPAIGN_ID, playerInvestigator: '01001', seed }, [{ seat: 0 }])
  settle(game)
  return game
}
function startChapter(game, scenarioId) {
  startScenario(game, indexOf(scenarioId), [])
  settle(game)
  return game
}

// ---------------------------------------------------------------------------
// 0. 章节模块 / manifest
// ---------------------------------------------------------------------------
test('重返夜之狂热：RtG/RtMM 章节 manifest 通过注册期契约', () => {
  assert.equal(gathering.manifest.id, 'returnToTheGathering')
  assert.equal(gathering.manifest.campaignId, CAMPAIGN_ID)
  assert.equal(gathering.manifest.referenceCode, '50011')
  assert.deepEqual(gathering.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3'])
  assert.equal(Object.keys(gathering.LOCATIONS).length, 12)
  assert.equal(gathering.ENCOUNTER_DECK.length, 30)
  assert.equal(gathering.SET_ASIDE_LOCATION_IDS.length, 8)

  assert.equal(masks.manifest.id, 'returnToTheMidnightMasks')
  assert.equal(masks.manifest.referenceCode, '50025')
  assert.deepEqual(masks.manifest.resolutionIds, ['noResolution', 'r1', 'r2'])
  assert.equal(Object.keys(masks.LOCATIONS).length, 9)
  assert.equal(masks.ENCOUNTER_DECK.length, 23)
  assert.equal(masks.CULTIST_DECK_CODES.length, 8)
  assert.ok(SCENARIO_IDS.includes('returnToTheGathering'))
  assert.ok(SCENARIO_IDS.includes('returnToTheMidnightMasks'))
})

// ---------------------------------------------------------------------------
// 1. RtG 开局布置 + 幕 1/2 背面
// ---------------------------------------------------------------------------
test('RtG：真实引擎开局布置（异常通道起点/新房间/放一边区/30 张遭遇牌库）', () => {
  const game = newGame('ret-notz-gathering-setup')
  startChapter(game, 'returnToTheGathering')
  assert.equal(game.scenario.id, 'returnToTheGathering')
  assert.equal(game.investigators[0].location, 'study')
  const ids = game.locations.map(location => location.id)
  for (const id of ['study', 'guestHall', 'bedroom', 'bathroom']) assert.ok(ids.includes(id), `缺少 ${id}`)
  assert.ok(game.locations.find(location => location.id === 'study').revealed)
  assert.equal(game.encounterDeck.length, 30)
  const setAside = game.scenarioZones.setAside
  for (const code of ['01116', '01117', '50017', '50019', '50021', '01115']) assert.ok(setAside.includes(code), `放一边缺少 ${code}`)
  const variants = game.scenarioFlags.retGatheringVariants
  assert.ok(['attic', 'atticReturn'].includes(variants.atticId))
  assert.ok(['cellar', 'cellarReturn'].includes(variants.cellarId))
  assert.deepEqual(game.acts.map(act => act.originalCode), ['50012', '01109', '01110'])
  assert.deepEqual(game.agendas.map(agenda => agenda.originalCode), ['01105', '01106', '01107'])
  assert.equal(game.agendas[0].doomThreshold, 3)
})

test('RtG：幕 1 背面放墙上的洞并揭示 → 幕 2 背面放客厅/丽塔/食尸鬼祭司', () => {
  const game = newGame('ret-notz-gathering-advance')
  startChapter(game, 'returnToTheGathering')
  const inv = game.investigators[0]
  // 测试夹具：放到会客厅并给足线索；幕 1 目标（3 线索/人，只有会客厅可付）由引擎动作触发检查。
  inv.location = 'guestHall'
  inv.clues = 3
  game.chaosBag = ['0']
  applyMove(game, 0, { action: 'resource' })
  settle(game)
  assert.equal(game.acts[game.actIndex].originalCode, '01109', '幕 1 应推进到「灼热屏障」')
  const hole = game.locations.find(location => location.id === 'holeInTheWall')
  assert.ok(hole, '幕 1 背面应把墙上的洞放置入场')
  assert.ok(hole.revealed, '幕 1 背面应揭示墙上的洞')
  // 规则事务重放会替换 investigators 数组元素，断言必须取当前引用。
  assert.equal(game.investigators[0].location, 'holeInTheWall', '选中的会客厅调查员应立即进入墙上的洞')
  const variants = game.scenarioFlags.retGatheringVariants
  for (const id of [variants.atticId, variants.cellarId, 'parlor']) {
    assert.ok(game.locations.some(location => location.id === id), `揭示走廊后应放入 ${id}`)
  }
  // 幕 2 背面（真实引擎推进，无待决选择）。
  inTransaction(game, draft => advanceAct(draft, []))
  settle(game)
  assert.equal(game.acts[game.actIndex].originalCode, '01110', '幕 2 应推进到「瞧瞧你们做的好事！」')
  assert.ok(game.locations.some(location => location.id === 'parlor' && location.revealed))
  const lita = (game.storyAssets || []).find(asset => asset.code === '01117')
  assert.ok(lita && lita.location === 'parlor', '丽塔应放在客厅')
  const priest = game.enemies.find(enemy => enemy.code === '01116')
  assert.ok(priest && priest.location === 'holeInTheWall', '食尸鬼祭司应生成在走廊')
})

// ---------------------------------------------------------------------------
// 2. RtG 结局记录 + 存档往返（真实战斗动作击败食尸鬼祭司）
// ---------------------------------------------------------------------------
test('RtG：幕 3 击败食尸鬼祭司 → 结局 1 记录/奖励写入；JSON 存档往返后视图一致', () => {
  const game = newGame('ret-notz-gathering-resolution')
  startChapter(game, 'returnToTheGathering')
  // 走完幕 1/幕 2 背面（真实引擎推进），让食尸鬼祭司入场。
  inTransaction(game, draft => advanceAct(draft, []))
  settle(game)
  inTransaction(game, draft => advanceAct(draft, []))
  settle(game)
  assert.equal(game.acts[game.actIndex].originalCode, '01110')
  const priest = game.enemies.find(enemy => enemy.code === '01116')
  assert.ok(priest, '幕 2 背面应生成食尸鬼祭司')
  // 真实战斗动作：调查员与祭司交战，削到 1 点生命后用战斗行动击败。
  const inv = game.investigators[0]
  inv.location = priest.location
  game.currentSeat = 0
  game.phase = 'investigation'
  game.turnSeat = 0
  game.chaosBag = ['0']
  priest.health = 1
  priest.damageTaken = 0
  priest.engagedSeat = 0
  priest.exhausted = false
  for (const other of game.enemies) if (other !== priest) other.engagedSeat = null
  inv.engaged = [priest.id]
  inv.actionsLeft = 3
  applyMove(game, 0, { action: 'fight', enemyId: priest.id })
  settle(game)
  assert.ok(!game.enemies.some(enemy => enemy.code === '01116' && !enemy.defeated), '食尸鬼祭司应被击败')
  // 非 hubFlow 的测试对局在结局后由引擎自动推进到下一关：结局记录落在 scenarioResults。
  const result = game.campaign.scenarioResults.at(-1)
  assert.ok(result, '应写入一条剧本结算记录')
  assert.equal(result.scenarioId, 'returnToTheGathering')
  assert.equal(result.resolution, 'r1', '默认选择烧毁房屋（r1）')
  assert.equal(result.recordsAfter.houseBurned, true)
  assert.equal(result.recordsAfter.ghoulPriestAlive, false)
  assert.equal(result.recordsAfter.litaOwner !== undefined || result.recordsAfter.litaForcedOthers !== undefined, true)
  // 结局钩子的 XP 声明：在独立夹具上断言 bonus 数字。
  const fixture = { campaign: { leadSeat: 0, records: {} }, investigators: [{ seat: 0, resigned: false, defeated: false }],
    victoryDisplay: [], scenarioFlags: {}, scenarioZones: {} }
  const hookResult = gathering.behavior.resolution(fixture, 'r1', [], { info() {} })
  assert.equal(hookResult.bonus, 2)
  assert.equal(hookResult.seatBonus(0), 0)
  // JSON 存档往返：视图与合法行动一致，重放同一动作结果一致。
  const saved = JSON.parse(JSON.stringify(game))
  migrateState(saved)
  assert.equal(JSON.stringify(viewState(saved, 0)), JSON.stringify(viewState(game, 0)), '存档往返后观察投影应一致')
  const movesBefore = legalMoves(game).map(move => `${move.action}:${move.locationId ?? move.enemyId ?? ''}`).sort()
  const movesAfter = legalMoves(saved).map(move => `${move.action}:${move.locationId ?? move.enemyId ?? ''}`).sort()
  assert.deepEqual(movesAfter, movesBefore, '存档往返后合法行动应一致')
  const probe = legalMoves(game).find(move => move.action === 'resource' || move.action === 'draw')
  if (probe) {
    const replay = JSON.parse(JSON.stringify(saved))
    applyMove(game, 0, { action: probe.action })
    settle(game)
    applyMove(replay, 0, { action: probe.action })
    settle(replay)
    assert.equal(JSON.stringify(viewState(replay, 0)), JSON.stringify(viewState(game, 0)), '存档重放动作后投影应一致')
  }
})

// ---------------------------------------------------------------------------
// 3. RtMM 开局布置 + 密谋推进 + 结局记录
// ---------------------------------------------------------------------------
test('RtMM：真实引擎开局布置（随机密谋/地点变体/5 张异教徒牌堆/23 张遭遇牌库）', () => {
  const game = newGame('ret-notz-masks-setup')
  startChapter(game, 'returnToTheMidnightMasks')
  assert.equal(game.scenario.id, 'returnToTheMidnightMasks')
  const agenda1 = game.agendas[0]
  assert.ok(['50026a', '01121a'].includes(agenda1.originalCode))
  assert.equal(game.agendas[1].originalCode, '01122')
  assert.equal(game.cultistDeck.length, 5, '8 张混洗后移除 3 张应剩 5 张')
  assert.equal(game.encounterDeck.length, 23)
  for (const id of ['rivertown', 'southside', 'miskatonicUniversity', 'downtown', 'easttown', 'northside']) {
    assert.ok(game.locations.some(location => location.id === id), `缺少地点 ${id}`)
  }
  assert.ok(game.locations.length === 9 || game.locations.length === 8)
  assert.equal(game.locations.some(location => location.id === 'yourHouse'), !game.campaign.records.houseBurned)
  const acolytes = game.enemies.filter(enemy => enemy.code === '50041')
  assert.equal(acolytes.length, Math.max(0, game.numInvestigators - 1))
})

test('RtMM：密谋 1 背面生成对应猎手 → 结局 2 记录 pastMidnight', () => {
  const game = newGame('ret-notz-masks-resolution')
  startChapter(game, 'returnToTheMidnightMasks')
  const variant = game.agendas[0].originalCode
  inTransaction(game, draft => advanceAgenda(draft, []))
  settle(game)
  const expected = variant === '50026a' ? '50026b' : '01121b'
  assert.ok(game.enemies.some(enemy => enemy.code === expected), `密谋 1 背面应生成 ${expected}`)
  try {
    finishScenario(game, 'r2', [])
  } catch (error) {
    if (!/剧本结算完成/.test(String(error?.message))) throw error
  }
  settle(game)
  assert.equal(game.campaign.records.pastMidnight, true)
  const result = game.campaign.scenarioResults.at(-1)
  assert.ok(result, '应写入一条剧本结算记录')
  assert.equal(result.scenarioId, 'returnToTheMidnightMasks')
  assert.equal(result.resolution, 'r2')
})

// ---------------------------------------------------------------------------
// 5. 单卡条目自测（条目文件已落盘；这里直接验证注册与规则读点）
// ---------------------------------------------------------------------------
test('单卡条目：已注册 + 地点揭示/诡计显现/谈判规则按条目结算', async () => {
  const { registeredEntry, registerCardAbilities } = await import('../src/engine/ability.js')
  const gatheringDir = '../src/cards/encounter-entries/returnToNightOfTheZealot/returnToTheGathering/'
  const masksDir = '../src/cards/encounter-entries/returnToNightOfTheZealot/returnToTheMidnightMasks/'
  // 50040 由 RtG/RtDB 共用 → 战役 _shared/ghouls_of_umôrdhoth/（归属算法要求）。
  const sharedDir = '../src/cards/encounter-entries/returnToNightOfTheZealot/_shared/ghouls_of_umôrdhoth/'
  const entries = {}
  for (const [code, dir] of [
    ['50017', gatheringDir], ['50018', gatheringDir], ['50019', gatheringDir],
    ['50020', gatheringDir], ['50021', gatheringDir], ['50024', gatheringDir], ['50040', sharedDir],
    ['50031', masksDir], ['50044', masksDir], ['50045', masksDir], ['50046', masksDir],
  ]) {
    entries[code] = (await import(dir + code + '.js')).default
    assert.equal(entries[code].code, code)
    // 索引由主进程统一重建；尚未并入索引的条目在测试进程内补注册（与 oneLastJob 用例同法）。
    if (!registeredEntry(code)) registerCardAbilities([entries[code]])
    assert.ok(registeredEntry(code), `${code} 应已注册`)
  }
  const baseState = game => ({
    investigators: game.investigators,
    locations: game.locations,
    campaign: game.campaign,
    scenarioFlags: game.scenarioFlags,
    encounterDeck: [],
    encounterDiscard: [],
  })
  // 50017 揭示：把选中的阁楼/地窖与客厅放入场。
  const game = newGame('ret-notz-entries')
  startChapter(game, 'returnToTheGathering')
  const state = baseState(game)
  const placed = []
  const api = {
    place: id => placed.push(id),
    info: () => {},
    test: (seat, skill, difficulty, resolve) => resolve?.({ success: true, value: difficulty }),
  }
  entries['50017'].locationRule.onReveal(state, { id: 'holeInTheWall' }, api)
  const variants = game.scenarioFlags.retGatheringVariants
  assert.deepEqual(placed.sort(), ['parlor', variants.atticId, variants.cellarId].sort())
  // 50019/50021 揭示的失败分支：未掷骰时应有 api.test 调用；这里验证检定被发起。
  let tests = 0
  const testApi = { test: (seat, skill, difficulty, resolve) => { tests += 1; assert.ok(['willpower', 'agility'].includes(skill)); resolve?.({ success: false, value: difficulty - 1 }) },
    discardRandom: () => 1, info: () => {}, place: () => {}, shuffleEncounterDeck: () => {},
    takeEncounterDeckCard: () => null, takeEncounterDiscard: () => null, drawEncounter: () => {} }
  entries['50019'].locationRule.onReveal(state, { id: 'farAboveYourHouse' }, testApi, 0)
  entries['50021'].locationRule.onReveal(state, { id: 'deepBelowYourHouse' }, testApi, 0)
  assert.equal(tests, 2, '50019/50021 揭示各发起一次检定')
  // 50024 显现：手牌 ≤3 的调查员受 1 伤害 1 恐惧。
  let damage = 0
  let horror = 0
  const inv = { seat: 0, name: '调查员1', hand: [], defeated: false, resigned: false }
  entries['50024'].encounterResolve({ investigators: [inv] }, inv, { code: '50024' }, {
    damage: (seat, amount = 1) => { assert.equal(seat, 0); damage += amount },
    horror: (seat, amount = 1) => { assert.equal(seat, 0); horror += amount },
    test: (seat, skill, difficulty, resolve) => resolve?.({ success: true }), discardRandom: () => 0, info: () => {},
  })
  assert.equal(damage, 1)
  assert.equal(horror, 1)
  // 50031 显现：无线索时放 1 毁灭。
  let doom = 0
  entries['50031'].encounterResolve({ investigators: [{ clues: 0, hand: [], defeated: false, resigned: false }] },
    inv, { code: '50031' }, { horror: () => 0, addDoom: amount => { doom += amount }, info: () => {} })
  assert.equal(doom, 1)
  // 50044 谈判：加入胜利区并检定意志(4)。
  let victory = null
  let tested = null
  entries['50044'].abilities[0].resolve({ inv, source: { id: 'e1', code: '50044' }, api: {
    scenario: { addEnemyToVictory: enemy => { victory = enemy } },
    info: () => {},
    test: (seat, skill, difficulty) => { tested = { seat, skill, difficulty } },
  } })
  assert.equal(victory?.code, '50044')
  assert.deepEqual(tested, { seat: 0, skill: 'willpower', difficulty: 4 })
})

// ---------------------------------------------------------------------------
// 6. 双语指南源（content/scenario-guide-sources/<scenarioId>.json）结构校验
// ---------------------------------------------------------------------------
test('双语指南源：id/campaignId/分节/结局块与 manifest resolutionIds 一一对应', () => {
  for (const chapter of [gathering, masks]) {
    const path = new URL(`../content/scenario-guide-sources/${chapter.manifest.id}.json`, import.meta.url)
    const guide = JSON.parse(readGuideFile(path, 'utf8'))
    assert.equal(guide.id, chapter.manifest.id)
    assert.equal(guide.campaignId, CAMPAIGN_ID)
    const sections = ['intro', 'setup', 'specialRules', 'story', 'resolutions']
    const shape = locale => {
      const l = guide.locales[locale]
      assert.ok(l, `缺少 locales.${locale}`)
      for (const section of sections) assert.ok(Array.isArray(l[section]), `${locale}.${section} 必须是数组`)
      assert.ok(l.intro.length > 0, `${locale}.intro 不能为空`)
      assert.ok(l.setup.length > 0, `${locale}.setup 不能为空`)
      assert.ok(l.resolutions.length > 0, `${locale}.resolutions 不能为空`)
      return {
        setupIds: l.setup.map(block => block.id),
        specialRuleIds: l.specialRules.map(block => block.id),
        resolutionIds: l.resolutions.map(block => block.id),
      }
    }
    const zh = shape('zh')
    const en = shape('en')
    assert.deepEqual(en.setupIds, zh.setupIds, '中英 setup 块 id 必须一一对应')
    assert.deepEqual(en.specialRuleIds, zh.specialRuleIds, '中英 specialRules 块 id 必须一一对应')
    assert.deepEqual(en.resolutionIds, zh.resolutionIds, '中英 resolutions 块 id 必须一一对应')
    for (const resolutionId of chapter.manifest.resolutionIds) {
      assert.ok(zh.resolutionIds.some(id => id === resolutionId || id.startsWith(`${resolutionId}-`)),
        `缺少结局 ${resolutionId} 的指南块`)
    }
    // 正文不得残留 HTML 标签或未翻译占位符。
    const body = JSON.stringify(guide.locales)
    assert.ok(!/<[a-z][^>]*>/i.test(body), '指南正文不得含 HTML 标签')
    assert.ok(!/\{[a-zA-Z_]+\}/.test(body.replace(/\{\{[^}]*\}\}/g, '')), '指南正文不得含 {token} 占位')
  }
})

// ---------------------------------------------------------------------------
// 7. 端到端大厅流程（campaign 50 注册后）：创建战役 → 首章开局 → 结束 → hubContinue → 第二关
// ---------------------------------------------------------------------------
test('端到端：大厅创建 campaign 50 → RtG 开局 → 结束 → hubContinue → RtMM 开局', () => {
  const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
  assert.ok(campaign, 'campaign 50 需已注册到生产组合根（本用例在注册后启用）')
  const plain = move => Object.fromEntries(Object.entries(move || {})
    .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))
  const play = (state, move, seat = 0) => { applyMove(state, seat, plain(move)); settle(state) }
  const find = (state, action, seat = 0) => legalMoves(state, seat).find(move => move.action === action)

  const game = createGameState({
    campaignId: CAMPAIGN_ID, campaignHub: true, playerInvestigator: '01001',
    seed: 'ret-notz-hub-e2e', difficulty: 'standard', rulesMode: 'simplified',
  }, [{ seat: 0, role: 'human' }])
  settle(game)
  assert.equal(game.uiState, 'campaignHub')
  assert.equal(game.hubFlow, true)

  // 大厅：队长 → 选关 → 进入设置。
  if (find(game, 'hubSetLeader')) play(game, find(game, 'hubSetLeader'))
  if (find(game, 'hubSelectScenario')) play(game, find(game, 'hubSelectScenario'))
  const setup = find(game, 'hubGoSetup')
  assert.ok(setup, '缺少 hubGoSetup')
  play(game, setup)
  assert.equal(game.uiState, 'scenarioSetup')
  // 座位准备：选人 → 自动牌组 → 确认 → 完成。
  const pick = legalMoves(game, 0).find(move => move.action === 'hubSelectInvestigator' && move.code === '01001')
  assert.ok(pick, '缺少可选调查员 01001')
  play(game, pick)
  const deck = find(game, 'hubAutoDeck')
  assert.ok(deck, '缺少 hubAutoDeck')
  play(game, deck)
  const confirm = find(game, 'hubConfirmDeck')
  assert.ok(confirm, '缺少 hubConfirmDeck')
  play(game, confirm)
  const seatDone = find(game, 'hubDoneSeat')
  assert.ok(seatDone, '缺少 hubDoneSeat')
  play(game, seatDone)
  assert.equal(game.hubReady, true)
  const leader = find(game, 'hubSetLeader')
  if (leader) play(game, leader)
  const begin = find(game, 'hubBeginScenario')
  assert.ok(begin, '缺少 hubBeginScenario')
  play(game, begin)
  assert.equal(game.uiState, 'inScenario')
  assert.equal(game.scenario.id, 'returnToTheGathering')
  assert.equal(game.investigators[0].location, 'study')

  // 结算第一章（引擎契约调试指令：与普通行动同一 ScenarioEnded 边界，走真实大厅结算）。
  applyMove(game, 0, { action: 'debug', kind: 'endScenario', resolutionKey: 'r1' })
  settle(game)
  assert.equal(game.uiState, 'scenarioResult')
  const first = game.campaign.scenarioResults.at(-1)
  assert.equal(first.scenarioId, 'returnToTheGathering')
  assert.equal(first.resolution, 'r1')
  assert.equal(first.recordsAfter.houseBurned, true)

  // 从结算继续：幕间窗口 → 第二章设置 → 开始第二章。
  const cont = find(game, 'hubContinue')
  assert.ok(cont, '缺少 hubContinue')
  play(game, cont)
  for (let guard = 0; guard < 120 && game.uiState === 'interlude'; guard += 1) {
    settle(game)
    const done = find(game, 'hubDoneSeat')
    assert.ok(done, '幕间缺少 hubDoneSeat')
    play(game, done)
  }
  assert.equal(game.uiState, 'scenarioSetup')
  const beginSecond = find(game, 'hubBeginScenario')
  assert.ok(beginSecond, '缺少第二章 hubBeginScenario')
  play(game, beginSecond)
  assert.equal(game.uiState, 'inScenario')
  assert.equal(game.scenario.id, 'returnToTheMidnightMasks')
  // 第一章 r1 烧毁房屋：第二章从河岸城开始（不放置「你的房子」）。
  assert.equal(game.campaign.records.houseBurned, true)
  assert.equal(game.investigators[0].location, 'rivertown')
})
// ---------------------------------------------------------------------------
// 4. RtDB（Lead 并行交付；存在才测）
// ---------------------------------------------------------------------------
test('RtDB：章节可加载且真实引擎开局（Lead 交付后自动启用）', { skip: !devourer }, () => {
  assert.ok(devourer)
  assert.equal(devourer.manifest.id, 'returnToTheDevourerBelow')
  const game = newGame('ret-notz-devourer-setup')
  startChapter(game, 'returnToTheDevourerBelow')
  assert.equal(game.scenario.id, 'returnToTheDevourerBelow')
  assert.equal(game.investigators[0].location, 'mainPath')
  const woods = game.locations.filter(location => (location.traits || []).includes('Woods'))
  assert.ok(woods.length >= 5, '主道路 + 随机 4 张阿卡姆密林')
})
