// 《食梦者》P9.5 真实战役测试外壳：把 8 章 + 真实 parts/flows/modes 注册成可启动内容，
// 供 P9.5 的双线矩阵/幕间/浏览器验收在真实引擎上跑（P10 前 TDE 不进 content/registered.js）。
//
// 做法（与 P9 的 tests/tde-browser-shell.mjs 同一思路，区别是这里注册**完整战役**而不是单章外壳）：
//   1. P10 前：克隆 tdeCampaign / tdeInvestigators / tdePlayer 三个内容包为 playable 并注册 8 章；
//   2. P10 后：生产组合根已注册同一批 id，直接复用（否则重复 id 校验会失败）；
//   3. 动态 import 引擎与 mod 边界（引擎初始化时读内容注册表，必须在注册之后 import）。
//
// 只在测试进程用；`content/registered.js` 的生产组合根在 P10 已真实注册。
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as tdeCampaign } from '../content/campaigns/theDreamEaters/manifest.js'
import { manifest as tdeCampaignPack } from '../content/packs/tdeCampaign/manifest.js'
import { manifest as tdeInvestigators } from '../content/packs/tdeInvestigators/manifest.js'
import { manifest as tdePlayer } from '../content/packs/tdePlayer/manifest.js'
import { TDE_SCENARIO_IDS } from '../content/campaigns/theDreamEaters/parts.js'

export const P95_CAMPAIGN_ID = 'theDreamEaters'
export const P95_INVESTIGATOR_CODES = Object.freeze(['06001', '06002', '06003', '06004', '06005'])

let worldPromise = null

/** 注册真实 TDE 战役外壳并返回引擎/mod 句柄（进程内只注册一次）。 */
export function loadTdeCampaignWorld() {
  worldPromise ||= loadOnce()
  return worldPromise
}

async function loadOnce() {
  // P10 前：在测试进程内把真实 TDE 外壳注册成 playable；P10 后生产组合根已注册同一批 id，
  // 再注册会触发「重复关卡/包 id」校验，所以检测到生产已注册时直接复用（内容完全相同）。
  const production = contentRegistry.getCampaign(P95_CAMPAIGN_ID)
  let campaign = tdeCampaign
  const scenarios = []
  if (production) {
    campaign = production
    for (const scenarioId of TDE_SCENARIO_IDS) {
      scenarios.push({ manifest: contentRegistry.getScenario(scenarioId), scenario: contentRegistry.getScenarioData(scenarioId), behavior: contentRegistry.getBehavior(scenarioId) })
    }
  } else {
    const packs = [tdeCampaignPack, tdeInvestigators, tdePlayer].map(pack => ({ ...pack, status: 'playable' }))
    registerContentBundle({ packs })
    for (const scenarioId of TDE_SCENARIO_IDS) {
      const module = await import(`../content/campaigns/theDreamEaters/scenarios/${scenarioId}/index.js`)
      scenarios.push({
        scenario: module.scenario,
        behavior: module.behavior,
        manifest: { ...module.manifest, status: 'playable' },
      })
    }
    campaign = { ...tdeCampaign, status: 'playable', dualLineGate: 'open' }
    registerContentBundle({ campaigns: [campaign], scenarios })
  }
  const engine = await import('../src/engine/engine.js')
  const modModule = await import('../index.js')
  const mod = modModule.default || modModule
  const parallelRuntime = await import('../src/integration/parallel-runtime.js')
  const observation = await import('../src/integration/observation.js')
  return { engine, mod, campaign, scenarios, parallelRuntime, observation }
}

// ---------------------------------------------------------------------------
// 建局 / 开局面板驾驶
// ---------------------------------------------------------------------------

/** 依次回答开局中的所有待决选择（取 done/skip 或第一项），直到没有待决选择。 */
export function settlePendingChoices(engine, state, { seatHint = null, mover = null, maxRounds = 300 } = {}) {
  const commit = mover || ((target, seat, move) => engine.applyMove(target, seat, move))
  for (let guard = 0; state.pendingChoice && guard < maxRounds; guard += 1) {
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    commit(state, seatHint ?? pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  if (state.pendingChoice) throw new Error(`开局选择未收敛：${state.pendingChoice.kind}`)
  return state
}

/** 并行容器上的待决选择：seat 已是房间座位，必须走 mod 边界（并行线由 lane adapter 路由）。 */
export function settleHostedChoices(engine, state, mod, options = {}) {
  return settlePendingChoices(engine, state, {
    ...options,
    mover: (target, seat, move) => mod.applyMove(target, seat, move),
  })
}

/** 当前决策座位；测试里的 hub 动作统一按它提交。 */
export const decisionSeatOf = (engine, state) => engine.decisionSeat(state)

const plainMove = move => Object.fromEntries(Object.entries(move)
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

/** 合法动作（缺省取当前决策座位）。 */
export function legalFor(engine, state, seat = null) {
  return engine.legalMoves(state, seat ?? engine.decisionSeat(state))
}

/** 提交一个合法动作（自动去掉 UI 字段）。 */
export function play(engine, state, move, seat = null) {
  if (!move) throw new Error('缺少合法动作')
  engine.applyMove(state, seat ?? engine.decisionSeat(state), plainMove(move))
  return state
}

export function findMove(engine, state, action, seat = null) {
  return legalFor(engine, state, seat).find(move => move.action === action)
}

/** 选调查员：按给定顺序挑一个当前可选的 TDE 调查员。 */
function pickInvestigator(engine, state, seat, preferred) {
  const options = legalFor(engine, state, seat).filter(move => move.action === 'hubSelectInvestigator')
  if (!options.length) throw new Error(`座位 ${seat} 没有可选调查员`)
  const wanted = preferred.find(code => options.some(move => move.code === code))
  if (wanted) return options.find(move => move.code === wanted)
  const tde = options.find(move => P95_INVESTIGATOR_CODES.includes(move.code))
  return tde || options[0]
}

/**
 * 从大厅台面驱动到「开始当前关卡」之前：
 *   createGameState(campaignHub) → 选模式 → 出发准备 → 每座位选人/自动牌组/确认 → 返回状态。
 * `preferredInvestigators` 可指定各座位优先的调查员；`assignParts` 可在准备阶段改线。
 */
export function hubSetup(engine, {
  seats = 4, mode = 'parallel', seed = 'tde-p95', preferredInvestigators = P95_INVESTIGATOR_CODES,
  assignParts = null,
} = {}) {
  const state = engine.createGameState({
    campaignId: P95_CAMPAIGN_ID, campaignHub: true, seed,
  }, Array.from({ length: seats }, (_, seat) => ({ seat })))
  settlePendingChoices(engine, state)
  const modeMove = legalFor(engine, state).find(move => move.action === 'hubSetMode' && move.mode === mode)
  if (!modeMove) throw new Error(`开局模式不可用：${mode}`)
  play(engine, state, modeMove)
  play(engine, state, findMove(engine, state, 'hubGoSetup'))
  for (let seat = 0; seat < seats; seat += 1) {
    const selected = pickInvestigator(engine, state, seat, preferredInvestigators)
    play(engine, state, selected, seat)
    const deck = findMove(engine, state, 'hubAutoDeck', seat)
    if (deck) play(engine, state, deck, seat)
    if (assignParts) {
      const part = assignParts[seat]
      const change = legalFor(engine, state, seat).find(move =>
        move.action === 'hubSetSeatPart' && move.seat === seat && move.part === part)
      if (change) play(engine, state, change, seat)
      else if (state.campaign.seatParts[seat] !== part) throw new Error(`座位 ${seat} 不能改线到 ${part}`)
    }
    const done = findMove(engine, state, 'hubDoneSeat', seat)
    if (done) play(engine, state, done, seat)
    settlePendingChoices(engine, state)
  }
  settlePendingChoices(engine, state)
  return state
}

/** 开始当前关卡（纯引擎；并行模式需走 mod.applyMove，由调用方选择）。 */
export function hubBegin(engine, state, { viaMod = false, mod = null } = {}) {
  const begin = legalFor(engine, state).find(move => move.action === 'hubBeginScenario')
  if (!begin) throw new Error('没有「开始当前关卡」动作')
  if (begin.disabled) throw new Error(`开始当前关卡不可用：${begin.explanation}`)
  if (viaMod) {
    mod.applyMove(state, engine.decisionSeat(state), plainMove(begin))
    settleHostedChoices(engine, state, mod)
    // 并行容器：两条线各自的开局故事/选择挂在 laneState.pendingChoice 上，逐线回答。
    if (state.parallel) settleParallelLaneChoices(engine, mod, state)
  } else {
    engine.applyMove(state, engine.decisionSeat(state), plainMove(begin))
    settlePendingChoices(engine, state)
  }
  return state
}

/** 在并行容器上提交房间座位动作（mod 边界），并结算随后的所有待决选择。 */
export function playHosted(engine, mod, state, move, seat = null) {
  if (!move) throw new Error('缺少合法动作')
  mod.applyMove(state, seat ?? engine.decisionSeat(state), plainMove(move))
  settleHostedChoices(engine, state, mod)
  return state
}

/** 并行容器：逐条结算两条线上挂起的待决选择（laneSeat → roomSeat 由 laneRuntime 提供）。 */
export function settleParallelLaneChoices(engine, mod, state, { maxRounds = 400 } = {}) {
  for (let guard = 0; guard < maxRounds; guard += 1) {
    let answered = false
    for (const lane of ['A', 'B']) {
      const laneState = state.parallel?.lanes?.[lane]
      const pending = laneState?.pendingChoice
      if (!pending) continue
      const laneSeat = pending.seat ?? 0
      const roomSeat = laneState.laneRuntime?.roomSeats?.[laneSeat] ?? laneSeat
      const optionId = pending.options?.find(option => ['done', 'skip'].includes(option.id))?.id
        || pending.options?.[0]?.id
      if (!optionId) throw new Error(`并行 ${lane} 线待决选择没有选项`)
      mod.applyMove(state, roomSeat, { action: 'choose', choiceId: pending.id, optionId })
      answered = true
      break
    }
    if (!answered) return state
  }
  throw new Error('并行待决选择未收敛')
}

/** 并行容器投影（按房间座位；无该座位时返回公开视图）。 */
export function projectParallelView(mod, state, roomSeat = 0, options = { includeStatic: true }) {
  return mod.viewState(state, roomSeat, options)
}

/** 并行容器单文件存档（稳定字符串）。world 为 loadTdeCampaignWorld() 的返回值。 */
export function serializeContainer(world, state) {
  return world.parallelRuntime.serializeParallelState(state)
}

/** 并行容器读档。 */
export function restoreContainer(world, text) {
  return world.parallelRuntime.restoreParallelState(text)
}

// Human confirmations are explicit: shared story, then each lane's real upgrade and start controls.
export function finishParallelSharedStory(engine, mod, state, { beginNext = true } = {}) {
  for (let guard=0;state.parallel.interlude;guard++) {
    if (guard>=200) throw new Error('共享幕间未收敛')
    const q=state.parallel.interlude.state.pendingChoice
    if (!q) throw new Error('共享幕间缺少待决选择')
    const optionId=q.options.find(option=>['done','skip'].includes(option.id))?.id || q.options[0].id
    mod.applyMove(state,q.seat,{action:'choose',choiceId:q.id,optionId})
  }
  if (!beginNext || state.status==='ended') return state
  for (const lane of ['A','B']) {
    for (const seat of state.parallel.lanes[lane].laneRuntime.roomSeats) {
      const done=mod.legalMoves(state,seat).find(move=>move.action==='hubDoneSeat' && !move.disabled)
      if (done) mod.applyMove(state,seat,plainMove(done))
      settleParallelLaneChoices(engine,mod,state)
    }
    const seat=state.parallel.lanes[lane].laneRuntime.roomSeats[0]
    const begin=mod.legalMoves(state,seat).find(move=>move.action==='hubBeginScenario' && !move.disabled)
    if (!begin) throw new Error('共享幕间后缺少下一章开始动作：'+lane)
    mod.applyMove(state,seat,plainMove(begin))
    settleParallelLaneChoices(engine,mod,state)
  }
  return state
}
