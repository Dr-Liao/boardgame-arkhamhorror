// P0 独立验收套件 · 真实引擎驱动层
//
// 口径（对齐 task-8）：
//   · 只用生产组合根 tests/eote-p8-fixture.mjs 暴露的真实引擎入口
//     （loadEoteWorld/createHubGame/hubSetup/legalMoves/applyMove/settleChoices/…）
//     以及 src/engine/engine.js 导出的真实引擎函数（advanceAgenda/checkAgenda/advanceAct/
//     performTest/drawEncounter/resolveSpecialToken/scenarioRuntime/…）。
//   · 不 import content behavior 的私有函数来「直调冒充真实路径」；行为断言必须经过
//     legalMoves/applyMove/pendingChoice/engine 钩子等生产读点。
//   · 章节进入用真实 hub 流程（序幕 → 检查点/幕间选项 → 场景 setup）；仅「为了到达目标章节」
//     用引擎调试指令 endScenario 结算前置章节（fixture 的合法入口，与普通结算同一事务边界）。
import {
  loadEoteWorld, createHubGame, hubSetup, legalFor, decisionSeat, playMove, settleChoices,
  finishScenario, continueFromResult, beginChapter, plainMove, codesOf,
} from '../../../../../../tests/eote-p8-fixture.mjs'

export {
  loadEoteWorld, createHubGame, hubSetup, legalFor, decisionSeat, playMove, settleChoices,
  finishScenario, continueFromResult, beginChapter, plainMove, codesOf,
}

export const relPath = file => `games/arkhamhorror/${file}`
export const MOD_ROOT = new URL('../../../../../../', import.meta.url)

// ---------------------------------------------------------------------------
// 断言记录
// ---------------------------------------------------------------------------

export class Recorder {
  constructor() {
    this.cases = []
    this.current = null
  }

  startCase(id, title) {
    this.current = { id, title, status: 'pass', checks: [], error: null, startedAt: Date.now() }
    this.cases.push(this.current)
    return this.current
  }

  /** 子断言；condition 为真 = PASS。actual/expected/evidence 均写入结果与报告。 */
  check(name, condition, { expected = '', actual = '', evidence = '', detail = '' } = {}) {
    const record = {
      name,
      status: condition ? 'pass' : 'fail',
      expected: typeof expected === 'string' ? expected : JSON.stringify(expected),
      actual: typeof actual === 'string' ? actual : JSON.stringify(actual),
      evidence,
      ...(detail ? { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) } : {}),
    }
    this.current.checks.push(record)
    if (!condition) this.current.status = 'fail'
    return Boolean(condition)
  }

  /** 记录一个「探测值」但不作为 PASS/FAIL（用于报告里的实测证据）。 */
  note(name, value, evidence = '') {
    this.current.checks.push({
      name, status: 'info', expected: '', actual: typeof value === 'string' ? value : JSON.stringify(value), evidence,
    })
  }

  failCase(error) {
    this.current.status = 'fail'
    this.current.error = { message: error?.message || String(error), stack: String(error?.stack || '') }
  }

  summarize() {
    const counts = { pass: 0, fail: 0, checks: 0, info: 0 }
    for (const item of this.cases) {
      counts[item.status] += 1
      for (const check of item.checks) {
        counts.checks += 1
        if (check.status === 'pass') counts.pass += 1
        else if (check.status === 'fail') counts.fail += 1
        else counts.info += 1
      }
    }
    return counts
  }
}

// ---------------------------------------------------------------------------
// 真实引擎驱动
// ---------------------------------------------------------------------------

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state))
}

function isScenarioEnded(error) {
  return error?.constructor?.name === 'ScenarioEnded' || /ScenarioEnded/.test(String(error?.name || ''))
}

const DEFAULT_OPTION_IDS = ['done', 'skip', 'self', 'keep', 'no']

/**
 * 在真实规则事务里调用引擎函数（advanceAgenda/checkAgenda/performTest/drawEncounter/…）。
 * 引擎的 requestChoice 只允许在事务内执行（resolution.js），因此行为断言必须走这里：
 *   · events 由引擎 info() 写入（跨 checkpoints 重放可能重复，只用于「出现与否」判断）；
 *   · pendingChoice 逐条回答（默认 done/skip/self/keep/取消，或调用方 select）；
 *   · ScenarioEnded 视为正常关卡结束（与 applyMove 事务同一口径）。
 */
export function drive(world, state, fn, { select = null, seat = null } = {}) {
  const events = []
  const info = { events, scenarioEnded: false, result: undefined, pending: [], error: null }
  const execute = draft => {
    try {
      info.result = fn(draft, events)
    } catch (error) {
      if (isScenarioEnded(error)) { info.scenarioEnded = true; return }
      throw error
    }
  }
  const initialSeat = seat ?? decisionSeat(world, state) ?? 0
  let thrown = null
  try {
    world.resolution.resolveTransaction(state, initialSeat, { action: 'p0AcceptProbe' }, execute)
    for (let guard = 0; state.pendingChoice; guard++) {
      if (guard > 300) throw new Error(`待决选择未收敛：${state.pendingChoice.kind}`)
      const choice = state.pendingChoice
      const chosen = (select ? select(choice, state) : null)
        ?? DEFAULT_OPTION_IDS.find(id => choice.options.some(option => option.id === id))
        ?? choice.options[0]?.id
      info.pending.push({ kind: choice.kind, source: choice.source, prompt: choice.prompt, chosen })
      world.resolution.resolveTransaction(state, choice.seat,
        { action: 'choose', choiceId: choice.id, optionId: chosen }, execute)
    }
  } catch (error) {
    thrown = error
  }
  // 事务直接结算不会重算派生缓存；补算一次，与 applyMove 收尾一致（fixture.transact 同口径）。
  state.legalMoves = world.engine.legalMoves(state)
  if (thrown) throw thrown
  return info
}

/** 只取 pendingChoice 选项（不提交），用于观察真实窗口是否提供某能力。 */
export function peekChoiceOptions(state) {
  return (state.pendingChoice?.options || []).map(option => ({
    id: option.id, label: option.label, assetId: option.assetId, freeCode: option.freeCode,
  }))
}

export function settleAll(world, state, select = null) {
  const answered = []
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 300) throw new Error(`待决选择未收敛：${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const chosen = (select ? select(choice, state) : null)
      ?? ['done', 'skip', 'self', 'keep', 'no'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    answered.push({ kind: choice.kind, source: choice.source, chosen })
    world.engine.applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: chosen })
  }
  return answered
}

export function legalActions(state, world, seat = null) {
  const actualSeat = seat ?? decisionSeat(world, state)
  return legalFor(world, state, actualSeat)
}

export function pickMove(moves, predicate) {
  return moves.find(predicate) || null
}

export function moveLabels(moves, limit = 40) {
  return moves.slice(0, limit).map(move => `${move.action}${move.rule ? `:${move.rule}` : ''}${move.label ? `「${move.label}」` : ''}`)
}

// ---------------------------------------------------------------------------
// 章节打开（真实 hub 流程 + 检查点/幕间分支选择）
// ---------------------------------------------------------------------------

const SCENARIO_RESOLUTION_ORDER = ['resolution1', 'victory', 'resolution2', 'resolution3', 'resolution0', 'defeat', 'noResolution']

function pickResolutionKey(state) {
  const keys = Object.keys(state.scenario?.resolutions || {})
  for (const key of SCENARIO_RESOLUTION_ORDER) if (keys.includes(key)) return key
  return keys[0] || null
}

function wantsFatalMirage(target) {
  return target === 'fatalMirage' || target?.id === 'fatalMirage'
}

function targetScenarioId(target) {
  return typeof target === 'string' ? target : target?.id
}

function targetFmEntry(target) {
  if (typeof target === 'string') return target === 'fatalMirage' ? 1 : 0
  return target?.id === 'fatalMirage' ? (target.entry || 1) : 0
}

/** 检查点/幕间分支：朝目标章节方向选择。 */
function flowSelectFor(world, getState, target) {
  const id = targetScenarioId(target)
  const fmEntry = targetFmEntry(target)
  return (choice, state) => {
    const node = state.campaign?.flow?.nodeId || ''
    const ids = (choice.options || []).map(option => option.id)
    const entered = Number(state.campaign?.records?.eoteFatalMirageEntries) || 0
    if (node.includes('checkpoint1Choice')) {
      if (['iceAndDeathPart2', 'iceAndDeathPart3'].includes(id)) return ids.includes('search') ? 'search' : null
      return ids.includes('abandon') ? 'abandon' : null
    }
    if (node.includes('checkpoint2Choice')) {
      if (id === 'iceAndDeathPart3') return ids.includes('stand') ? 'stand' : null
      return ids.includes('flee') ? 'flee' : null
    }
    if (ids.includes('open') && ids.includes('ignore')) {
      const needFm = id === 'fatalMirage' && entered < fmEntry
      return needFm ? 'open' : 'ignore'
    }
    return null
  }
}

/**
 * 打开指定章节的 inScenario 状态（真实 hub 流程；前置章节用调试 endScenario 正常结算）。
 * target: 'iceAndDeathPart1' | … | 'theHeartOfMadnessPart2' | { id:'fatalMirage', entry:2|3 }
 */
export function createChapterOpener(world) {
  const cache = new Map()
  return function openChapterState(target, { seats = 2, investigatorCodes = ['08001', '08004'], seed = null } = {}) {
    const id = targetScenarioId(target)
    const entry = targetFmEntry(target)
    const key = `${id}#${entry}#${seats}#${investigatorCodes.join(',')}`
    if (!cache.has(key)) {
      const state = openChapterStateImpl(world, target, { seats, investigatorCodes, seed: seed || `p0-open-${key}` })
      cache.set(key, JSON.stringify(state))
    }
    return JSON.parse(cache.get(key))
  }
}

function openChapterStateImpl(world, target, { seats, investigatorCodes, seed }) {
  const id = targetScenarioId(target)
  const fmEntry = targetFmEntry(target)
  const state = createHubGame(world, { seats, seed, investigatorCodes })
  hubSetup(world, state, { investigatorCodes })
  const select = flowSelectFor(world, () => state, target)
  let fmEntries = 0
  let seenFm = false
  for (let step = 0; step < 20; step++) {
    if (state.status !== 'playing') throw new Error(`战役提前结束（目标 ${id}）：status=${state.status} uiState=${state.uiState}`)
    if (state.uiState !== 'inScenario') {
      // 兜底：仍在流程节点上时继续走完（正常不会到这里）
      continueFromResult(world, state, { upgrades: false, storySelect: select })
      if (state.uiState === 'scenarioSetup') {
        beginChapter(world, state)
        continue
      }
      throw new Error(`无法进入关卡（目标 ${id}）：uiState=${state.uiState} node=${state.campaign?.flow?.nodeId}`)
    }
    const scenarioId = state.scenario?.id
    if (scenarioId === 'fatalMirage') {
      if (!seenFm) { fmEntries += 1; seenFm = true }
    } else {
      seenFm = false
    }
    if (scenarioId === id && (id !== 'fatalMirage' || fmEntries === fmEntry)) return state
    const resolution = pickResolutionKey(state)
    if (!resolution) throw new Error(`章节 ${scenarioId} 没有可结算的 resolution 键`)
    finishScenario(world, state, resolution)
    if (state.status !== 'playing') throw new Error(`结算 ${scenarioId} 后战役结束（目标 ${id}）`)
    const info = continueFromResult(world, state, { upgrades: false, storySelect: select })
    if (info.uiState === 'scenarioSetup') {
      beginChapter(world, state)
    } else if (info.uiState === 'campaignResult') {
      throw new Error(`战役在到达目标 ${id} 前结束`)
    }
  }
  throw new Error(`打开章节 ${id} 超过步数上限`)
}

// ---------------------------------------------------------------------------
// 章节内真实动作驱动
// ---------------------------------------------------------------------------

/** 把某座位移动到一个已知地点（真实引擎 relocate 入口）。 */
export function relocate(world, state, seat, locationId) {
  return drive(world, state, draft => world.engine.relocateInvestigator(draft, seat, locationId, []))
}

/** 在指定地点生成一名真实敌人（引擎 spawnEnemy 入口；敌人定义来自印刷数据）。 */
export function spawnEnemyAt(world, state, code, locationId, { engagedSeat = null, overrides = {} } = {}) {
  const before = new Set((state.enemies || []).map(enemy => enemy.id))
  drive(world, state, (draft, events) => world.engine.spawnEnemy(draft, code, locationId, events, { engagedSeat, ...overrides }))
  return (state.enemies || []).find(enemy => !before.has(enemy.id)) || null
}

/** 设定确定性的混乱袋（真实检定会从 state.chaosBag 抽取）。 */
export function setChaosBag(state, tokens) {
  state.chaosBag = [...tokens]
}

/** 用于期待「成功」的检定：单枚 +1 标记（数值检定必过）。 */
export const CERTAIN_SUCCESS = Object.freeze(['+1'])
/** 用于期待「失败」的检定：autofail。 */
export const CERTAIN_FAIL = Object.freeze(['autofail'])

/** 把卡注入某调查员手牌/资产区（仅状态准备；行为断言仍走真实引擎读点）。 */
export function injectAsset(state, seat, code, extra = {}) {
  const inv = state.investigators[seat]
  const asset = {
    id: `probe-${code}-${seat}-${(inv.assets || []).length}`, code, originalCode: code,
    name: '', exhausted: false, damage: 0, horror: 0, controllerSeat: seat, ...extra,
  }
  inv.assets ||= []
  inv.assets.push(asset)
  return asset
}

export function injectHand(state, seat, code) {
  state.investigators[seat].hand ||= []
  state.investigators[seat].hand.push(code)
}

export function handOf(state, seat) {
  return state.investigators[seat]?.hand || []
}

export function assetOf(state, seat, code) {
  return (state.investigators[seat]?.assets || []).find(asset => (asset.originalCode || asset.code) === code) || null
}

export function locationOf(state, id) {
  return (state.locations || []).find(location => location.id === id) || null
}

/** 当前关卡某类日志（events 是纯 JSON；引擎 info 写入 events）。 */
export function storyEvents(events, predicate = () => true) {
  return (events || []).filter(event => predicate(event))
}

/** 读取 P8 生产组合根的卡面印刷数据（唯一事实源）。 */
export async function printedCards() {
  return (await import('../../../../../../src/cards/cards-data.js')).ALL_CARDS
}

/** 章节 manifest（生产注册表）。 */
export function manifestOf(world, scenarioId) {
  return world.contentRegistry.getScenario(scenarioId)
}
