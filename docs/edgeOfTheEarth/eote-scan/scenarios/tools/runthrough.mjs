// EOTE 八章 + 战役流程 · 真实引擎 run-through（D3）。
//
// 目标：不满足于 p8 夹具的 `debug endScenario`，而是用**真实引擎合法动作**逐章驱动若干轮/
// 直至自然结算，检测：死锁（无合法动作/待决选择不收敛）、未注册钩子（applyMove 抛错）、
// 幕/议程无法推进、自然结局不可达；随后用调试结局继续整条战役，验证流程节点顺序、
// 检查点/幕间/致命幻景分支、存档往返与记录闭环。
//
// 运行：node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/tools/runthrough.mjs
// 输出：games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/logs/runthrough.json + runthrough.md
import fs from 'node:fs'
import path from 'node:path'
import {
  loadEoteWorld, createHubGame, hubSetup, settleChoices, legalFor, decisionSeat,
  playMove, beginChapter, finishScenario, continueFromResult, saveAndRestore,
  INVESTIGATOR_CODES, SCENARIO_IDS,
} from '../../../../../tests/eote-p8-fixture.mjs'

const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/logs'
fs.mkdirSync(OUT, { recursive: true })
const world = await loadEoteWorld()

const KEY_PRIORITY = ['resolution1', 'victory', 'resolution2', 'noResolution']
function resolutionKeyFor (state) {
  const keys = Object.keys(state.scenario?.resolutions || {})
  for (const key of KEY_PRIORITY) if (keys.includes(key)) return key
  return keys[0]
}

function snapshot (state) {
  const s = state.scenario || {}
  const acts = state.acts || []
  const agendas = state.agendas || []
  const codes = list => list.map(card => String(card?.originalCode || card?.code || ''))
  const tokenMeanings = s.tokenMeanings || {}
  const charSize = state.chaosBag?.length || 0
  const eoteScenario = state.scenarioFlags?.mechanics?.eote || null
  return {
    uiState: state.uiState, scenarioId: s.id, status: state.status,
    startLocation: s.startLocation, investigatorLocation: state.investigators?.map(inv => inv.location),
    investigatorResources: state.investigators?.map(inv => inv.resources),
    round: state.round, doom: state.doom, actIndex: state.actIndex, agendaIndex: state.agendaIndex,
    locationCount: state.locations?.length || 0,
    revealedLocations: (state.locations || []).filter(loc => loc.revealed).map(loc => loc.id),
    actCodes: codes(acts), agendaCodes: codes(agendas),
    encounterDeck: state.encounterDeck?.length || 0,
    setAside: state.scenarioZones?.setAside?.length ?? null,
    setAsideLocations: state.scenarioZones?.setAsideLocations?.length ?? null,
    victoryDisplay: state.victoryDisplay?.length || 0,
    chaosBag: charSize,
    chaosDistinct: [...new Set(state.chaosBag || [])].sort(),
    tokenMeaningKeys: Object.keys(tokenMeanings),
    standardTokens: tokenMeanings.standard ? Object.keys(tokenMeanings.standard) : [],
    resolutionKeys: Object.keys(s.resolutions || {}),
    resolutionTextLengths: Object.fromEntries(Object.entries(s.resolutions || {}).map(([k, v]) => [k, String(v || '').length])),
    scenarioFlags: Object.keys(state.scenarioFlags || {}).filter(key => key !== 'mechanics'),
    tekeliDeck: eoteScenario?.tekeli ? { total: eoteScenario.tekeli.total, faces: eoteScenario.tekeli.faces?.length } : null,
    partnersRoster: state.campaign?.eote?.partners?.roster?.length ?? null,
    records: pickRecords(state),
    fableMirageVersion: state.scenarioFlags?.fatalMirageVersion ?? null,
  }
}

function pickRecords (state) {
  const records = state.campaign?.records || {}
  const pick = ['camp', 'locationsRevealed', 'iceAndDeathPart1Resolution', 'iceAndDeathPart1CampShelter',
    'iceAndDeathPart2Resolution', 'iceAndDeathPart3Resolution', 'fatalMirageResolution', 'fatalMirageTimes',
    'fatalMirageCompleted', 'eoteShelterValue', 'eoteMissingCount', 'eoteMissingPartners',
    'eoteEliminatedPartners', 'eoteCheckedPartners', 'eoteInterludeXp', 'eoteFatalMirageEntries',
    'eotePartnerStatuses', 'theTeamFledToTheMountains', 'theInvestigatorsConvincedDyerToAllowTheExpedition',
    'theSurvivorsOfTheExpeditionWere', 'memoriesBanished', 'memoriesDiscovered', 'xp']
  const out = {}
  for (const key of pick) if (Object.hasOwn(records, key)) out[key] = records[key]
  return out
}

function forceSettle (state, storySelect = () => null) {
  // 尽力结算遗留待决选择；返回是否清空。失败不抛（由调用方记录）。
  for (let guard = 0; state.pendingChoice && guard < 300; guard++) {
    try {
      choosePending(world, state, storySelect)
    } catch {
      try {
        const choice = state.pendingChoice
        playMove(world, state, { action: 'choose', choiceId: choice.id, optionId: choice.options[0].id }, choice.seat)
      } catch (error) {
        return { settled: false, message: String(error?.message || error) }
      }
    }
  }
  return { settled: !state.pendingChoice }
}

// ---------------------------------------------------------------------------
// 幕/议程揭示钩子探针：用合法调试指令（CONTRACT §3 debug kind）在状态副本上推进幕/议程，
// 直接暴露「reveal=campaignRule 但章节 behavior 未接线」的缺失钩子（真实引擎会抛错）。
// ---------------------------------------------------------------------------
function probeRevealHooks (state) {
  const result = { act: null, agenda: null, scenarioId: state.scenario?.id }
  const summarize = clone => ({
    enemies: clone.enemies?.length || 0,
    encounterDeck: clone.encounterDeck?.length || 0,
    encounterDiscard: clone.encounterDiscard?.length || 0,
    doom: clone.doom || 0,
    actIndex: clone.actIndex, agendaIndex: clone.agendaIndex,
    locations: clone.locations?.length || 0,
    locationClues: (clone.locations || []).reduce((sum, loc) => sum + (loc.clues || 0), 0),
    setAside: clone.scenarioZones?.setAside?.length ?? null,
    setAsideLocations: clone.scenarioZones?.setAsideLocations?.length ?? null,
    victoryDisplay: clone.victoryDisplay?.length || 0,
  })
  const run = kind => {
    const clone = structuredClone(state)
    const before = summarize(clone)
    const beforeScenario = clone.scenario?.id
    try {
      world.engine.applyMove(clone, 0, { action: 'debug', kind })
      return {
        ok: true, uiState: clone.uiState, endUiState: clone.uiState, resolution: clone.resolution ?? null,
        scenarioChanged: clone.scenario?.id !== beforeScenario, before, after: summarize(clone),
      }
    } catch (error) {
      return { ok: false, message: String(error?.message || error) }
    }
  }
  if (state.acts?.length && state.actIndex < state.acts.length) result.act = run('advanceAct')
  if (state.agendas?.length && state.agendaIndex < state.agendas.length) result.agenda = run('advanceAgenda')
  return result
}

// ---------------------------------------------------------------------------
// 场景内真实动作驱动
// ---------------------------------------------------------------------------
function choosePending (world, state, storySelect) {
  const choice = state.pendingChoice
  const answer = storySelect ? storySelect(choice, state) : null
  const optionId = answer
    ?? ['done', 'skip', 'self', 'keep', 'no', 'decline', 'cancel'].find(id => choice.options.some(option => option.id === id))
    ?? choice.options[0].id
  playMove(world, state, { action: 'choose', choiceId: choice.id, optionId }, choice.seat)
}

const MOVE_PRIORITY = ['scenarioAction', 'advanceAct', 'resign', 'investigate', 'move', 'endTurn', 'draw', 'resource']

function chooseMove (state, moves, seat) {
  const has = action => moves.find(move => move.action === action)
  // 有可用的章节动作/幕推进时优先（自然结算路线）。
  for (const action of ['scenarioAction', 'advanceAct']) {
    const move = has(action)
    if (move) return move
  }
  // 撤退动作只在「不再有可收集线索」时才用；否则先调查/移动。
  const clueMoves = moves.filter(move => move.action === 'investigate')
  if (clueMoves.length) return clueMoves[0]
  const usefulMove = moves.filter(move => move.action === 'move')
    .map(move => ({ move, target: (state.locations || []).find(loc => loc.id === move.locationId) }))
    .find(entry => entry.target && (entry.target.clues > 0 || entry.target.revealed === false))
  if (usefulMove) return usefulMove.move
  const resign = has('resign')
  if (resign) return resign
  const endTurn = has('endTurn')
  if (endTurn) return endTurn
  return moves[0]
}

/**
 * 在 inScenario 内用合法动作驱动：轮数上限 maxRounds，步数上限 maxSteps。
 * 返回统计 + 自然结束信息 + 死锁/异常清单。
 */
function driveScenario (state, { label, maxRounds = 6, maxSteps = 260, storySelect = () => null } = {}) {
  const stats = {
    label, scenarioId: state.scenario?.id, startUi: state.uiState, steps: 0, choices: 0,
    actions: {}, movesSeen: [], errors: [], deadlocks: [], actAdvances: 0, agendaAdvances: 0,
    startRound: state.round, endRound: state.round, naturalEnd: false, endUiState: null,
    hangups: [],
  }
  const startAct = state.actIndex
  const startAgenda = state.agendaIndex
  try {
    for (let step = 0; step < maxSteps; step++) {
      let guard = 0
      while (state.pendingChoice) {
        if (++guard > 200) { stats.hangups.push(`待决选择不收敛：${state.pendingChoice.kind}`); break }
        stats.choices += 1
        choosePending(world, state, storySelect)
      }
      if (stats.hangups.length) break
      if (state.status !== 'playing' || state.uiState !== 'inScenario') break
      if ((state.round || 1) > maxRounds) break
      const seat = decisionSeat(world, state)
      const moves = seat == null ? [] : legalFor(world, state, seat).filter(move => move.disabled !== true)
      for (const move of moves) {
        const key = move.rule ? `${move.action}:${move.rule}` : move.action
        if (!stats.movesSeen.includes(key)) stats.movesSeen.push(key)
      }
      if (!moves.length) {
        stats.deadlocks.push({ step, phase: state.phase, round: state.round, uiState: state.uiState, seat })
        break
      }
      const move = chooseMove(state, moves, seat)
      try {
        playMove(world, state, move, seat)
      } catch (error) {
        stats.errors.push({ step, action: move.action, rule: move.rule || null, message: String(error?.message || error), stack: String(error?.stack || '').split('\n').slice(0, 14) })
        const fatal = /is not a function|not a function|undefined is not|null is not|Cannot read|尚未迁移/.test(String(error?.message || error))
        if (fatal) break
        // 非致命：把这个动作类型记入黑名单，避免死循环。
        stats.hangups.push(`动作反复抛错：${move.action}`)
        break
      }
      stats.steps += 1
      stats.actions[move.action] = (stats.actions[move.action] || 0) + 1
      if ((state.actIndex || 0) > startAct) stats.actAdvances = (state.actIndex || 0) - startAct
      if ((state.agendaIndex || 0) > startAgenda) stats.agendaAdvances = (state.agendaIndex || 0) - startAgenda
    }
    // 收尾：把剩余待决选择结算掉（引擎可能在最后一步留下选择）。
    try {
      settleChoices(world, state)
    } catch (error) {
      stats.errors.push({ step: stats.steps, action: 'settleChoices', message: String(error?.message || error) })
    }
  } catch (error) {
    stats.errors.push({ step: stats.steps, action: 'driver', message: String(error?.message || error), fatal: true })
  }
  stats.endRound = state.round
  stats.endUiState = state.uiState
  stats.naturalEnd = state.uiState !== 'inScenario'
  stats.actIndex = state.actIndex
  stats.agendaIndex = state.agendaIndex
  return stats
}

// ---------------------------------------------------------------------------
// 战役驱动（真实动作章节内 + 调试结局跨章）
// ---------------------------------------------------------------------------
function runCampaign (config) {
  const {
    label, answers = {}, seed = `rt-${label}`, difficulty = 'standard', seats = 2,
    maxRounds = 5, maxChapters = 12, upgrade = true, investigators = INVESTIGATOR_CODES.slice(0, 2),
  } = config
  const storySelect = (choice, state) => {
    const nodeId = state.campaign?.flow?.nodeId
    const wanted = answers[nodeId]
    if (!wanted) return null
    return choice.options.some(option => option.id === wanted) ? wanted : null
  }
  const state = createHubGame(world, { seats, seed, difficulty, investigatorCodes: investigators })
  hubSetup(world, state, { investigatorCodes: investigators })
  const reports = { label, config: { answers, seed, difficulty, maxRounds, maxChapters }, chapters: [], interludeNodes: [], flowHistory: [], errors: [] }
  for (let index = 0; index < maxChapters; index++) {
    if (state.status !== 'playing') break
    if (state.uiState !== 'inScenario') { reports.errors.push(`第 ${index + 1} 步未在 inScenario：${state.uiState}`); break }
    const chapter = {
      index, scenarioId: state.scenario?.id, setup: snapshot(state), drive: null, resolution: null, afterFlowNode: null,
    }
    chapter.drive = driveScenario(state, { label: `${label}#${index}`, maxRounds, storySelect })
    chapter.hookProbe = state.status === 'playing' && state.uiState === 'inScenario' ? probeRevealHooks(state) : null
    chapter.pendingBeforeFinish = forceSettle(state, storySelect)
    if (state.status === 'playing' && state.uiState === 'inScenario') {
      if (!chapter.pendingBeforeFinish.settled) {
        reports.errors.push(`第 ${index + 1} 章 ${state.scenario?.id} 仍有待决选择未收敛：${JSON.stringify(state.pendingChoice?.kind)}`)
        chapter.forcedResolution = null
        reports.chapters.push(chapter)
        break
      }
      const key = resolutionKeyFor(state)
      chapter.forcedResolution = key
      try {
        finishScenario(world, state, key, storySelect)
      } catch (error) {
        reports.errors.push(`第 ${index + 1} 章强制结局失败：${String(error?.message || error)}`)
        reports.chapters.push(chapter)
        break
      }
    } else if (state.uiState === 'scenarioResult') {
      chapter.forcedResolution = null
    }
    chapter.resolution = state.campaign?.scenarioResults?.at(-1)?.resolution || null
    chapter.afterFlowNode = state.campaign?.flow?.nodeId || null
    chapter.uiState = state.uiState
    chapter.resultsCount = state.campaign?.scenarioResults?.length || 0
    chapter.recordsAfter = pickRecords(state)
    reports.chapters.push(chapter)
    if (state.status !== 'playing') break
    if (state.uiState !== 'scenarioResult') { reports.errors.push(`第 ${index + 1} 章结算后停在 ${state.uiState}`); break }
    const info = continueFromResult(world, state, { upgrades: upgrade, storySelect })
    reports.interludeNodes.push(...info.nodes)
    if (state.status !== 'playing') break
    if (state.uiState !== 'scenarioSetup') { reports.errors.push(`第 ${index + 1} 章后未进入下一章准备：${state.uiState}`); break }
    chapter.interludeNodes = info.nodes
    chapter.interludeUpgrades = info.upgradePurchased
    beginChapter(world, state)
  }
  reports.final = {
    status: state.status, uiState: state.uiState, flowNode: state.campaign?.flow?.nodeId,
    flowStage: state.campaign?.flowStage, results: (state.campaign?.scenarioResults || []).map(r => r.scenarioId),
    records: pickRecords(state), eoteCampaign: state.campaign?.eote ? {
      partners: state.campaign.eote.partners?.roster?.length ?? null,
      mirage: state.campaign.eote.mirage ?? null,
      camp: state.campaign.eote.camp ?? null,
    } : null,
    completedSteps: state.campaign?.completedSteps ?? null,
  }
  reports.flowHistory = (state.campaign?.flow?.history || []).map(visit => visit.nodeId)
  return { state, reports }
}

// ---------------------------------------------------------------------------
// 0) 到达指定章节的辅助：前序章节用「真实动作 1 轮 + 调试结局」跨章
// ---------------------------------------------------------------------------
const MAIN_ANSWERS = Object.freeze({
  prologueChoice: 'believe', prologue4: 'skipIntros',
  checkpoint1Choice: 'search', checkpoint2Choice: 'stand',
  interlude1DoorChoice: 'ignore', interlude2Night2: 'ignore', interlude3Night4Choice: 'ignore',
})
const MIRAGE_ANSWERS = Object.freeze({
  prologueChoice: 'believe', prologue4: 'skipIntros',
  checkpoint1Choice: 'abandon', checkpoint2Choice: 'flee',
  interlude1DoorChoice: 'open',
  interlude2Night3Choice: 'open', interlude2Night4Choice: 'open',
  interlude3Night3Choice: 'open', interlude3Night4Choice: 'open',
})
function storySelectFor (answers = {}) {
  return (choice, state) => {
    const nodeId = state.campaign?.flow?.nodeId
    const wanted = answers[nodeId]
    if (!wanted) return null
    return choice.options.some(option => option.id === wanted) ? wanted : null
  }
}
function reachScenario (targetId, { answers = MAIN_ANSWERS, seed = `reach-${targetId}`, investigators = INVESTIGATOR_CODES.slice(0, 2), maxHop = 10, hopRounds = 1 } = {}) {
  const storySelect = storySelectFor(answers)
  const state = createHubGame(world, { seats: 2, seed, investigatorCodes: investigators })
  hubSetup(world, state, { investigatorCodes: investigators })
  const hops = []
  for (let hop = 0; hop < maxHop; hop++) {
    if (state.status !== 'playing') return { error: '战役提前结束', state, hops }
    if (state.uiState !== 'inScenario') return { error: `未在 inScenario：${state.uiState}`, state, hops }
    if (state.scenario?.id === targetId) return { state, hops }
    hops.push(state.scenario?.id)
    if (hopRounds > 0) driveScenario(state, { label: `hop-${hop}`, maxRounds: hopRounds, storySelect })
    if (state.uiState === 'inScenario') {
      if (!forceSettle(state, storySelect).settled) return { error: `前序 ${state.scenario?.id} 待决选择未收敛`, state, hops }
      try { finishScenario(world, state, resolutionKeyFor(state), storySelect) } catch (error) {
        return { error: `前序 ${state.scenario?.id} 结局失败：${String(error?.message || error)}`, state, hops }
      }
    }
    if (state.status !== 'playing') return { error: `战役在 ${state.scenario?.id || '?'} 后结束`, state, hops }
    try { continueFromResult(world, state, { upgrades: false, storySelect }) } catch (error) {
      return { error: `幕间推进失败：${String(error?.message || error)}`, state, hops }
    }
    if (state.status !== 'playing') return { error: '战间节点后战役结束', state, hops }
    if (state.uiState !== 'scenarioSetup') return { error: `未进入下一章准备：${state.uiState}`, state, hops }
    beginChapter(world, state)
  }
  return { error: '未到达目标章节', state, hops }
}

// ---------------------------------------------------------------------------
// 1a) 纯流程闭环（章节内不动作，直接调试结局）：验证 7 章主线 + 检查点/幕间 + 尾声/end
const reports = { generatedAt: new Date().toISOString(), runs: {}, static: {}, saveRestore: {}, checks: {} }
const flowRun = runCampaign({ label: 'flow-only', seed: 'rt-flow', maxRounds: 0, answers: MAIN_ANSWERS })
reports.runs.flowOnly = flowRun.reports
reports.checks.flowOnlySequence = flowRun.reports.chapters.map(chapter => chapter.scenarioId)
reports.checks.flowOnlyReachedEnd = flowRun.reports.final.status === 'over' && flowRun.reports.final.flowNode === 'end'
reports.checks.flowOnlyHistory = flowRun.reports.flowHistory

// 1) 主线完整战役（章节内真实动作 2 轮 + 调试结局跨章，验证流程闭环）
// ---------------------------------------------------------------------------
const mainRun = runCampaign({ label: 'main-full', seed: 'rt-main', maxRounds: 2, answers: MAIN_ANSWERS })
reports.runs.main = mainRun.reports
reports.checks.mainScenarioSequence = mainRun.reports.chapters.map(chapter => chapter.scenarioId)
reports.checks.mainReachedCampaignEnd = mainRun.reports.final.status === 'over' && mainRun.reports.final.flowNode === 'end'

// 2) fatalMirage 可选分支：检查点 I 放弃 → 幕间 1/2/3 全开门
const mirageRun = runCampaign({ label: 'mirage-branch', seed: 'rt-mirage', maxRounds: 2, answers: MIRAGE_ANSWERS })
reports.runs.mirage = mirageRun.reports
reports.checks.mirageScenarioSequence = mirageRun.reports.chapters.map(chapter => chapter.scenarioId)
reports.checks.mirageEntries = mirageRun.state.campaign?.records?.eoteFatalMirageEntries ?? null
reports.checks.mirageVersions = mirageRun.reports.chapters
  .filter(chapter => chapter.scenarioId === 'fatalMirage')
  .map(chapter => ({ version: chapter.setup.fableMirageVersion, agenda: chapter.setup.agendaCodes, act: chapter.setup.actCodes, setAsideLocations: chapter.setup.setAsideLocations }))
reports.checks.mirageRecordsAfter = mirageRun.reports.chapters
  .filter(chapter => chapter.scenarioId === 'fatalMirage')
  .map(chapter => ({ after: chapter.recordsAfter?.fatalMirageTimes, resolution: chapter.resolution }))

// ---------------------------------------------------------------------------
// 3) 逐章深驱动：每章 10 轮真实动作 + 幕/议程揭示钩子探针 + 自然结束可达性
// ---------------------------------------------------------------------------
const DEEP_TARGETS = Object.freeze([
  ['iceAndDeathPart1', MAIN_ANSWERS, 1], ['iceAndDeathPart2', MAIN_ANSWERS, 1], ['iceAndDeathPart3', MAIN_ANSWERS, 1],
  ['fatalMirage', MIRAGE_ANSWERS, 1], ['toTheForbiddenPeaks', MAIN_ANSWERS, 1], ['cityOfTheElderThings', MAIN_ANSWERS, 1],
  ['theHeartOfMadnessPart1', MAIN_ANSWERS, 0], ['theHeartOfMadnessPart2', MAIN_ANSWERS, 0],
])
const deepReports = []
for (const [targetId, answers, hopRounds] of DEEP_TARGETS) {
  const storySelect = storySelectFor(answers)
  const reach = reachScenario(targetId, { answers, hopRounds })
  if (reach.error) {
    deepReports.push({ id: targetId, reached: false, error: reach.error, hops: reach.hops })
    continue
  }
  const state = reach.state
  const setup = snapshot(state)
  const hookProbe = probeRevealHooks(state)
  const before = pickRecords(state)
  const drive = driveScenario(state, { label: `deep-${targetId}`, maxRounds: 10, storySelect })
  const naturalEnd = state.uiState !== 'inScenario'
  const pending = forceSettle(state, storySelect)
  deepReports.push({
    id: targetId, reached: true, hops: reach.hops, setup, hookProbe, drive, naturalEnd,
    naturalResolution: naturalEnd ? state.campaign?.scenarioResults?.at(-1)?.resolution || null : null,
    pending, endUiState: state.uiState, endStatus: state.status,
    recordsBefore: before, recordsAfter: pickRecords(state),
  })
}
reports.runs.deep = deepReports
reports.checks.deepSummary = deepReports.map(report => ({
  id: report.id, reached: report.reached, error: report.error,
  naturalEnd: report.naturalEnd, naturalResolution: report.naturalResolution,
  driveSteps: report.drive?.steps, driveActions: report.drive?.actions,
  driveErrors: report.drive?.errors, deadlocks: report.drive?.deadlocks,
  actProbe: report.hookProbe?.act, agendaProbe: report.hookProbe?.agenda,
}))

// 4) 检查点 II 逃跑：只跳过亡命冰原 III
const fleeRun = runCampaign({
  label: 'flee-checkpoint2', seed: 'rt-flee', maxRounds: 1, maxChapters: 5,
  answers: { prologueChoice: 'disbelieve', prologue4: 'skipIntros', checkpoint1Choice: 'search', checkpoint2Choice: 'flee', interlude1DoorChoice: 'ignore', interlude2Night2: 'ignore' },
})
reports.runs.flee = fleeRun.reports
reports.checks.fleeSequence = fleeRun.reports.chapters.map(chapter => chapter.scenarioId)

// 4) 失败/无结局：第一章直接 noResolution 结算后能否继续
{
  const codes = INVESTIGATOR_CODES.slice(0, 2)
  const state = createHubGame(world, { seats: 2, seed: 'rt-fail', investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes })
  const first = state.scenario?.id
  finishScenario(world, state, 'noResolution')
  const result = { firstScenario: first, afterFinishUi: state.uiState, resultKey: state.campaign?.scenarioResults?.at(-1)?.resolution }
  if (state.status === 'playing') {
    const info = continueFromResult(world, state, { upgrades: false })
    result.continueNodes = info.nodes
    result.uiStateAfterContinue = state.uiState
    result.status = state.status
  }
  reports.runs.failurePath = result
}

// 5) 存档往返：第一章结算 + 幕间后 JSON → migrateState 幂等 → 继续下一章
{
  const codes = INVESTIGATOR_CODES.slice(0, 2)
  const state = createHubGame(world, { seats: 2, seed: 'rt-save', investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes })
  finishScenario(world, state, resolutionKeyFor(state))
  continueFromResult(world, state, { upgrades: false })
  const before = snapshot(state)
  const saved = saveAndRestore(world, state)
  const report = {
    beforeUi: state.uiState, beforeScenario: state.scenario?.id, afterUi: saved.state.uiState,
    afterScenario: saved.state.scenario?.id, changes: saved.changes, secondChanges: saved.secondChanges,
    identicalRecords: JSON.stringify(pickRecords(state)) === JSON.stringify(pickRecords(saved.state)),
    before, jsonBytes: saved.text.length,
  }
  beginChapter(world, saved.state)
  report.continuedUi = saved.state.uiState
  report.continuedScenario = saved.state.scenario?.id
  reports.saveRestore = report
}

// ---------------------------------------------------------------------------
// 6) 静态矩阵：八章 setup 数据核对面（不依赖大厅推进）
// ---------------------------------------------------------------------------
{
  const matrix = []
  for (const id of SCENARIO_IDS) {
    const manifest = world.contentRegistry.getScenario(id)
    const data = world.contentRegistry.getScenarioData(id)
    matrix.push({
      id,
      manifest: manifest ? {
        acts: manifest.acts?.length, agendas: manifest.agendas?.length,
        locations: manifest.locations?.length, resolutionIds: manifest.resolutionIds,
        requiredEncounterGroupIds: manifest.requiredEncounterGroupIds,
        recordReads: manifest.recordReads?.length, recordWrites: manifest.recordWrites?.length,
        zones: Object.fromEntries(Object.entries(manifest.zones || {}).map(([zone, entries]) => [zone, (entries || []).reduce((sum, entry) => sum + entry.count, 0)])),
      } : null,
      scenario: data ? {
        startLocationId: data.startLocationId || data.startLocation,
        locations: data.locations?.length || Object.keys(data.locations || {}).length,
        acts: data.acts?.length, agendas: data.agendas?.length,
        resolutions: Object.keys(data.resolutions || {}),
        tokenMeaningKeys: Object.keys(data.tokenMeanings || {}),
        standardTokens: Object.keys(data.tokenMeanings?.standard || {}),
        encounterDeckSize: (data.encounterDeck || []).length,
        setAsideAliases: (data.setAsideAliases || []).length,
      } : null,
    })
  }
  reports.static.matrix = matrix
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
const jsonPath = path.join(OUT, 'runthrough.json')
fs.writeFileSync(jsonPath, JSON.stringify(reports, null, 1), 'utf8')
const lines = ['# EOTE 真实引擎 run-through 日志', '', `生成：${reports.generatedAt}`, '']
for (const [key, run] of Object.entries(reports.runs)) {
  if (!run || Array.isArray(run)) continue
  lines.push(`## run: ${key}`)
  if (run.chapters) {
    for (const chapter of run.chapters) {
      const drive = chapter.drive || {}
      lines.push(`- ${chapter.index + 1}. ${chapter.scenarioId} | 自然结束=${drive.naturalEnd} | 动作=${drive.steps} ${JSON.stringify(drive.actions)} | 幕推进=${drive.actAdvances} 议程推进=${drive.agendaAdvances} | 错误=${drive.errors.length} | 死锁=${drive.deadlocks.length}${chapter.forcedResolution ? ` | 调试结局=${chapter.forcedResolution}` : ''}`)
      if (drive.movesSeen) lines.push(`    合法动作集合：${drive.movesSeen.join(', ')}`)
      for (const error of drive.errors || []) {
        lines.push(`    ! error: ${error.action} — ${error.message}`)
        for (const frame of error.stack || []) lines.push(`        ${frame}`)
      }
      for (const deadlock of drive.deadlocks || []) lines.push(`    ! deadlock: ${JSON.stringify(deadlock)}`)
      for (const hangup of drive.hangups || []) lines.push(`    ! hangup: ${hangup}`)
      if (chapter.hookProbe) lines.push(`    钩子探针：act=${JSON.stringify(chapter.hookProbe.act)} agenda=${JSON.stringify(chapter.hookProbe.agenda)}`)
    }
    lines.push(`- 流程历史：${(run.flowHistory || []).join(' → ')}`)
    lines.push(`- 最终：${JSON.stringify(run.final?.records || {})}`)
    lines.push('')
  } else {
    lines.push('```json', JSON.stringify(run, null, 1), '```', '')
  }
}
lines.push('## checks', '```json', JSON.stringify(reports.checks, null, 1), '```', '')
lines.push('## saveRestore', '```json', JSON.stringify({ ...reports.saveRestore, before: undefined }, null, 1), '```', '')
fs.writeFileSync(path.join(OUT, 'runthrough.md'), lines.join('\n'), 'utf8')
console.log('WROTE', jsonPath)
console.log(JSON.stringify(reports.checks, null, 1))
