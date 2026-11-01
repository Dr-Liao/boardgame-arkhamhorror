// 并行双运行时管线（P5 批次 3）：一个房间、两条线各自跑自己的关卡。
//
// 口径：docs/tde-migration-roadmap.md §7.5.2（D8-C）：
//   · 容器 state 保留共享的 campaign / 座位表 / 大厅字段；两条线的完整运行时存在
//     `state.parallel.lanes.A/B`（各自一份引擎 state，单文件存档）；
//   · 大厅命令按座位所在线路由到对应 lane，并换成线内座位；全局修改只在容器上发生
//     （`revision`、事件 sequence、开闸标记）；
//   · 观察投影按座位取本线视图，另一条线只给公开摘要；
//   · 关卡屏障：两条线都结算到同一章对后，一次封盘再一起推进（`sealPairOnce` 语义）。
//
// 本模块是**接线层**：lane 的规则结算仍走既有引擎函数；不复制规则。玩家开闸仍留
// P9.5（双线 UI 与浏览器门禁），当前只由 `test:tde:parallel` 与大厅钩子使用。
import { campaignPartsManifest } from '../campaign/campaign-modes.js'
import { seatsOfLane, setPart } from '../campaign/campaign-parts.js'
import { partManifest } from '../campaign/part-flow.js'
import { contentRegistry } from '../../content/registered.js'
import { campaignGraph, enterCampaignNode } from '../campaign/campaign-flow.js'
import { initializeChaosBag } from '../engine/chaos-bag.js'
import { enterLaneRuntime } from '../engine/lane-runtime.js'
import {
  applyMove, decisionSeat, describeParts, executeCommand, legalMoves, seatLocalMove, validateMove,
} from '../engine/engine.js'
import { resolveTransaction } from '../engine/resolution.js'
import { viewState } from './observation.js'
import { aiDecisionContext } from '../ai/ai-context.js'

const LANES = ['A', 'B']
const clone = value => structuredClone(value)

export const isParallelState = state => Boolean(state?.parallel?.lanes?.A && state?.parallel?.lanes?.B)

/** 座位 → 线（容器上没有 seatParts 时返回 null）。 */
export function laneOfSeat(state, seat) {
  const lane = state?.campaign?.seatParts?.[seat]
  return LANES.includes(lane) ? lane : null
}

/** 座位 → 线的运行时状态；不属于任何线返回 null。 */
export function laneStateOf(state, seat) {
  if (!isParallelState(state)) return null
  const lane = laneOfSeat(state, seat)
  return lane ? state.parallel.lanes[lane] : null
}

function laneSeatOf(state, seat) {
  const laneState = laneStateOf(state, seat)
  if (!laneState?.laneRuntime) return null
  const index = laneState.laneRuntime.roomSeats.indexOf(seat)
  return index >= 0 ? index : null
}

// 大厅的 revision 是容器版本；lane 有自己的内部版本。引擎校验会比对 move.revision，
// 因此进入 lane 前必须去掉这个字段（外层 commitMove 已经校验过容器版本）。
const withoutRevision = move => {
  if (!move || typeof move !== 'object') return move
  if (!Object.hasOwn(move, 'revision') && !Object.hasOwn(move, 'laneRevision') && !Object.hasOwn(move, 'containerRevision')) return move
  const { revision, laneRevision, containerRevision, ...rest } = move
  return rest
}

function remapIndexedSeat(roomSeats, seat) {
  return Number.isInteger(seat) ? (roomSeats[seat] ?? seat) : seat
}

// 演出快照在线内用密集座位。投影按房间座位比对观察者，不换算会把 B 线玩家自己的手牌也清空。
function remapTableStateSeats(tableState, roomSeats) {
  if (!tableState || typeof tableState !== 'object') return tableState
  const copy = { ...tableState }
  if ('currentSeat' in copy) copy.currentSeat = remapIndexedSeat(roomSeats, copy.currentSeat)
  if ('turnSeat' in copy) copy.turnSeat = remapIndexedSeat(roomSeats, copy.turnSeat)
  if (Array.isArray(copy.investigators)) {
    copy.investigators = copy.investigators.map(inv => (
      inv && typeof inv === 'object' ? { ...inv, seat: remapIndexedSeat(roomSeats, inv.seat) } : inv
    ))
  }
  if (copy.privateTest && typeof copy.privateTest === 'object') {
    copy.privateTest = { ...copy.privateTest, seat: remapIndexedSeat(roomSeats, copy.privateTest.seat) }
  }
  return copy
}

function remapEventSeats(event, roomSeats) {
  const copy = { ...event }
  if (Number.isInteger(copy.seat)) copy.seat = remapIndexedSeat(roomSeats, copy.seat)
  if (Number.isInteger(copy.privateSeat)) copy.privateSeat = remapIndexedSeat(roomSeats, copy.privateSeat)
  if (copy.tableState) copy.tableState = remapTableStateSeats(copy.tableState, roomSeats)
  if (copy.presentation?.tableState) {
    copy.presentation = { ...copy.presentation, tableState: remapTableStateSeats(copy.presentation.tableState, roomSeats) }
  }
  return copy
}

/** 大厅命令：按座位路由到本线运行时。 */
export function parallelApplyMove(state, seat, move) {
  if (!isParallelState(state)) throw new Error('不是并行双运行时状态')
  const laneState = laneStateOf(state, seat)
  if (!laneState) throw new Error('该座位不属于任何线')
  const laneSeat = laneSeatOf(state, seat)
  if (laneSeat == null) throw new Error('该座位不在当前线的运行时里')
  // 本线标记：无 seat 字段的事件（info / presentation / checkpoint 等）也要能按线过滤（门禁 5）。
  const lane = laneOfSeat(state, seat)
  // 章对屏障：另一条线还没结算到同一对时，不允许本线开下一章。
  if (move?.action === 'hubBeginScenario') {
    const pair = (laneState.campaign.scenarioIndex ?? 0) + 1
    if (!state.parallel.sealed[pair]) {
      throw new Error('另一条线尚未结算到同一章对，下一章要等两边都完成')
    }
  }
  // 双版本（P9.5 门禁 8）：`laneRevision` 校验目标线；全局 `revision` 过期允许安全重基，
  // 所以这里只认 laneRevision（客户端投影同时回传两者，缺省不校验）。
  if (Object.hasOwn(move || {}, 'laneRevision') && move.laneRevision != null
    && move.laneRevision !== laneState.revision) {
    throw new Error(`STALE_REVISION：${lane} 线期望 ${laneState.revision}，收到 ${move.laneRevision}`)
  }
  const events = applyMove(laneState, laneSeat, withoutRevision(move)) || []
  // 全局提交序列：任一条线成功提交都推进顶层 revision（门禁 8）；各线 revision 由引擎自行递增。
  state.revision = (state.revision ?? 0) + 1
  // 本线关卡结算 → 记等待；两边到同一章对才封盘（先不自动推进，幕间交给各线玩家）。
  if (laneState.uiState === 'scenarioResult') markLaneFinished(state, lane)
  syncParallelStatus(state)
  // 事件离开引擎前把线内座位换回房间座位（含演出快照），并标记 lane。
  const roomSeats = laneState.laneRuntime?.roomSeats || []
  return events.map(event => {
    const copy = remapEventSeats(event, roomSeats)
    // 门禁 5：无 seat 的公共事件（info/presentation/checkpoint）也要带本线标记，
    // 否则 viewEvents 无法按观察者所属线过滤。
    copy.lane = copy.lane || lane
    return copy
  })
}

/** 容器状态与两条线保持一致：全部结束才结束；否则 playing。 */
export function syncParallelStatus(state) {
  if (!isParallelState(state)) return
  const playing = LANES.some(lane => state.parallel.lanes[lane].status === 'playing')
  state.status = playing ? 'playing' : 'ended'
  if (!playing) state.uiState = 'campaignResult'
}

/** 本线命令校验；座位不属于运行时返回原因字符串。 */
export function parallelValidateMove(state, seat, move) {
  const laneState = laneStateOf(state, seat)
  const laneSeat = laneSeatOf(state, seat)
  if (!laneState || laneSeat == null) return '该座位不属于当前双线运行时'
  return validateMove(laneState, laneSeat, withoutRevision(move))
}

/** 本线可执行动作；不是该线当前行动者时返回空数组。 */
export function parallelLegalMoves(state, seat) {
  const laneState = laneStateOf(state, seat)
  const laneSeat = laneSeatOf(state, seat)
  if (!laneState || laneSeat == null) return []
  return legalMoves(laneState, laneSeat)
}

/** 两条线的当前决策座位（换成房间座位；同一时刻可能有两个）。 */
export function parallelDecisionSeats(state) {
  if (!isParallelState(state)) return []
  return LANES.map(lane => {
    const laneState = state.parallel.lanes[lane]
    const seat = decisionSeat(laneState)
    if (seat == null) return null
    return laneState.laneRuntime?.roomSeats[seat] ?? null
  }).filter(seat => seat != null)
}

export function parallelDecisionSeat(state) {
  return parallelDecisionSeats(state)[0] ?? null
}

/** 两条线当前可行动座位（换回房间座位）。 */
export function parallelActingSeats(state) {
  if (!isParallelState(state)) return []
  const seats = []
  for (const lane of LANES) {
    const laneState = state.parallel.lanes[lane]
    const roomSeats = laneState.laneRuntime?.roomSeats || []
    const acting = []
    for (let laneSeat = 0; laneSeat < roomSeats.length; laneSeat += 1) {
      // 关卡内 actingSeats 由引擎决定；这里用 legalMoves 的可用性替代读取内部状态。
      if (legalMoves(laneState, laneSeat).length && decisionSeat(laneState) === laneSeat) acting.push(roomSeats[laneSeat])
    }
    seats.push(...acting)
  }
  return [...new Set(seats)].sort((left, right) => left - right)
}

export function parallelSeatLocalMove(state, seat, move) {
  const laneState = laneStateOf(state, seat)
  const laneSeat = laneSeatOf(state, seat)
  if (!laneState || laneSeat == null) return false
  return seatLocalMove(laneState, laneSeat, withoutRevision(move))
}

// P9.5 门禁 7：线内投影 → 房间座位投影。浏览器/大厅的 mySeat/observerSeat 是房间座位，
// 而 laneState 的 viewState 返回线内密集座位（0..n-1）；这里把座位类字段换回 roomSeat 再下发。
function laneViewToRoomSeats(view, roomSeats, roomLeadSeat) {
  if (!view || typeof view !== 'object') return view
  const mapSeat = seat => (Number.isInteger(seat) && roomSeats[seat] != null ? roomSeats[seat] : seat)
  const mapSeats = seats => (Array.isArray(seats) ? seats.map(mapSeat) : seats)
  const next = { ...view }
  if (Number.isInteger(next.currentSeat)) next.currentSeat = mapSeat(next.currentSeat)
  if (Number.isInteger(next.turnSeat)) next.turnSeat = mapSeat(next.turnSeat)
  if (Array.isArray(next.humanSeats)) next.humanSeats = mapSeats(next.humanSeats)
  for (const key of ['actingSeats', 'decisionSeats', 'waitingSeats']) {
    if (Array.isArray(next[key])) next[key] = mapSeats(next[key])
  }
  if (Array.isArray(next.investigators)) {
    next.investigators = next.investigators.map(inv => ({ ...inv, seat: mapSeat(inv.seat) }))
  }
  if (next.campaign && typeof next.campaign === 'object' && Number.isInteger(next.campaign.leadSeat)) {
    next.campaign = { ...next.campaign, leadSeat: mapSeat(next.campaign.leadSeat) }
  }
  if (roomLeadSeat != null) next.leadSeat = roomLeadSeat
  if (next.pendingChoice) {
    const choice = { ...next.pendingChoice }
    if (Number.isInteger(choice.seat)) choice.seat = mapSeat(choice.seat)
    if (Array.isArray(choice.seats)) choice.seats = mapSeats(choice.seats)
    if (Array.isArray(choice.options)) {
      choice.options = choice.options.map(option => (Number.isInteger(option?.responderSeat)
        ? { ...option, responderSeat: mapSeat(option.responderSeat) } : option))
    }
    next.pendingChoice = choice
  }
  return next
}

/** 本线视图；另一条线的座位拿到只读摘要（不含手牌/牌库/未公开剧情）。 */
export function parallelView(state, seat) {
  if (!isParallelState(state)) return null
  const lane = laneOfSeat(state, seat)
  if (!lane) return null
  const laneState = state.parallel.lanes[lane]
  const laneSeat = laneSeatOf(state, seat)
  const roomSeats = laneState.laneRuntime?.roomSeats || []
  const rawView = laneSeat == null ? null : viewState(laneState, laneSeat)
  const view = laneViewToRoomSeats(rawView, roomSeats, seat)
  const other = LANES.find(item => item !== lane)
  const otherState = state.parallel.lanes[other]
  return {
    ...(view || {}),
    // 门禁 8：投影同时携带全局提交序列与目标线版本；客户端提交时两者都回传。
    revision: state.revision ?? 0,
    parallel: {
      lane,
      laneRevision: laneState.revision ?? 0,
      pair: laneState.campaign.scenarioIndex + 1,
      scenarioId: laneState.scenario?.id ?? null,
      other: {
        lane: other,
        scenarioId: otherState.scenario?.id ?? null,
        phase: otherState.phase,
        round: otherState.round,
        seats: [...(otherState.laneRuntime?.roomSeats || [])],
        awaiting: state.parallel.awaiting?.[other] ?? null,
      },
      sealed: state.parallel.sealed || {},
    },
  }
}

/** 大厅代答用：把某条线当前的待决选择换回房间座位（A 优先、B 次之）。 */
export function parallelPendingChoice(state) {
  if (!isParallelState(state)) return state?.pendingChoice ?? null
  for (const lane of LANES) {
    const laneState = state.parallel.lanes[lane]
    const choice = laneState?.pendingChoice
    if (!choice) continue
    const roomSeats = laneState.laneRuntime?.roomSeats || []
    const mapSeat = seat => (Number.isInteger(seat) ? roomSeats[seat] ?? seat : seat)
    return {
      ...structuredClone(choice),
      lane,
      seat: mapSeat(choice.seat),
      seats: Array.isArray(choice.seats) ? choice.seats.map(mapSeat) : undefined,
      options: (choice.options || []).map(option => ({
        ...option,
        ...(Number.isInteger(option.responderSeat) ? { responderSeat: mapSeat(option.responderSeat) } : {}),
      })),
    }
  }
  return null
}

/** 观战/无座位视图：给公开投影（含一条线的公开牌桌摘要，两条线摘要另列）。 */
export function parallelPublicView(state) {
  if (!isParallelState(state)) return null
  // 观战没有座位：用 A 线的公开投影做底（不含手牌/牌库/私密剧情），再附两条线摘要。
  const base = viewState(state.parallel.lanes.A, null)
  const lanes = LANES.map(lane => {
    const laneState = state.parallel.lanes[lane]
    return {
      lane,
      scenarioId: laneState.scenario?.id ?? null,
      phase: laneState.phase,
      round: laneState.round,
      seats: [...(laneState.laneRuntime?.roomSeats || [])],
      awaiting: state.parallel.awaiting?.[lane] ?? null,
      status: laneState.status,
    }
  })
  return {
    ...base,
    schemaVersion: state.schemaVersion,
    status: state.status,
    uiState: state.uiState,
    revision: state.revision ?? 0,
    parallel: { lanes, sealed: state.parallel.sealed || {}, public: true },
  }
}

/** 本线 AI/描述文本（不暴露另一线）。 */
export function parallelDescribe(state, seat) {
  const laneState = laneStateOf(state, seat)
  const laneSeat = laneSeatOf(state, seat)
  if (!laneState || laneSeat == null) return ''
  const parts = describeParts(laneState, laneSeat)
  return `${parts.body}${aiDecisionContext(laneState, laneSeat)}${parts.tail ? `\n${parts.tail}` : ''}`
}

/** 本线选择：只接受本线座位的待决选择。 */
export function parallelAutoChoice({ state, seat, states }) {
  const laneState = laneStateOf(state, seat)
  const laneSeat = laneSeatOf(state, seat)
  if (!laneState || laneSeat == null) return null
  const choice = laneState.pendingChoice
  if (!choice || choice.seat !== laneSeat) return null
  const stateOf = code => states?.[code] ?? (laneState?.cards?.[code]?.autoByDefault ? 'auto' : 'ask')
  const triggerOptionId = choice.autoOptionId || choice.autoTriggerOptionId
  if (triggerOptionId && stateOf(choice.sourceCardCode) === 'auto') {
    return { action: 'choose', choiceId: choice.id, optionId: triggerOptionId }
  }
  return null
}

/** 单文件存档（容器含两条线）。 */
export function serializeParallelState(state) {
  if (!isParallelState(state)) throw new Error('不是并行双运行时状态')
  return `${JSON.stringify(state, null, 2)}\n`
}

/** 读档校验：两条线、schemaVersion、座位表都要在；失败抛错而不是静默修补。 */
export function restoreParallelState(text) {
  const state = typeof text === 'string' ? JSON.parse(text) : clone(text)
  if (!isParallelState(state)) throw new Error('存档不是并行双运行时状态')
  if (!Array.isArray(state.campaign?.seatParts) || state.campaign.seatParts.length !== (state.investigators || []).length) {
    throw new Error('并行存档的房间座位表缺失或与座位数不一致')
  }
  for (const lane of LANES) {
    const laneState = state.parallel.lanes[lane]
    if (!laneState?.laneRuntime) throw new Error(`并行存档缺少 ${lane} 线的运行时座位`)
    if (laneState.laneRuntime.part !== lane) throw new Error(`并行存档 ${lane} 线的 currentPart 不一致`)
  }
  return state
}

/**
 * 启动两条线：容器必须已经选定 parallel 模式、所有座位准备完毕（牌组已保存）。
 * 每条线复制一份容器、加载自己的 part scope、进入 lane 运行时并开始其第一章。
 */
export function launchParallelLanes(state, events = []) {
  const content = contentRegistry.getCampaign(state.campaign?.id)
  const manifest = content && campaignPartsManifest(content) ? content : null
  if (!manifest || state.campaign.mode !== 'parallel') throw new Error('只有声明 parts 且选择并行模式才能启动双运行时')
  if (isParallelState(state)) return { ok: false, reason: 'already-launched' }
  const counts = state.campaign.seatParts.reduce((out, part) => ({ ...out, [part]: (out[part] || 0) + 1 }), {})
  if (!counts.A || !counts.B || counts.A !== counts.B) {
    throw new Error(`并行开始前两线人数必须相等（A ${counts.A || 0} / B ${counts.B || 0}）`)
  }
  for (const lane of LANES) {
    const roomSeats = state.campaign.seatParts.reduce((out, part, seat) => (part === lane ? [...out, seat] : out), [])
    if (!roomSeats.length) throw new Error(`${lane} 线没有座位`)
    for (const seat of roomSeats) {
      const record = state.campaign.parts?.[lane]?.investigators?.[seat] ?? state.campaign.investigators?.[seat]
      if (!record?.deck?.length) throw new Error(`座位 ${seat} 还没有合法牌组，不能启动并行双线`)
    }
  }
  const lanes = {}
  for (const lane of LANES) {
    const laneState = clone(state)
    delete laneState.parallel
    // 线标识必须在任何 resolveTransaction 之前写入：事务 continuation 的 base 快照
    // 只包含当时已有的字段，晚写入会在首个待决选择恢复时被丢掉（P9.5 实测坑）。
    laneState.parallelLane = lane
    const campaign = laneState.campaign
    campaign.mode = lane === 'A' ? 'singleA' : 'singleB'
    // 每条线用自己的队长（房间座位；enterLaneRuntime 会换成线内座位）。
    campaign.leadSeat = campaign.partLeads?.[lane] ?? campaign.leadSeat
    campaign.leadConfirmed = true
    setPart(laneState, lane)
    campaign.parts = {}
    campaign.scenarioResults = []
    campaign.scenarioIndex = 0
    campaign.phase = 'scenarioSetup'
    laneState.uiState = 'scenarioSetup'
    laneState.phase = 'scenarioSetup'
    laneState.hubReady = true
    laneState.hubSeatDone = {}
    laneState.hubSeatSelected = {}
    enterLaneRuntime(laneState)
    // 每条线用自己章节顺序的 flow（单线流程），位置在第一关。
    const laneManifest = partManifest(manifest, campaign.mode)
    const graph = campaignGraph(laneManifest)
    enterCampaignNode(campaign, laneManifest, graph.start)
    // 混乱袋按本线重建（并行时两条线各一袋；TDE 的逐线袋由 manifest.partChaosBags 提供）。
    const bags = manifest.partChaosBags?.[lane] || manifest.chaosBags || state.campaign.chaosBags
    if (bags) initializeChaosBag(laneState, bags[laneState.difficulty] || bags.standard)
    // 与建局同一条入口：setup 用 resolveTransaction(initial) 跑开局/起始手牌/重调，
    // 不绕过选择检查点，也不经过 applyMove 的「合法动作」校验。
    // setup 只在「关卡内」分支执行，所以先把 uiState 置为 inScenario（hubFlow 保留给关间）。
    laneState.uiState = 'inScenario'
    laneState.phase = 'investigation'
    campaign.phase = 'scenario'
    resolveTransaction(laneState, 0, { action: 'setup' }, executeCommand, { initial: true })
    // 事务重建 state 时会丢掉 `legalMoves` 派生缓存（resolution.js#dynamicState 的 omitted 名单），
    // 建局路径在 setup.js#createGameState 里补算一次；并行 lane 也必须同口径补算。
    // 否则第一处待决选择若正好问本线真人（没有 AI 先提交动作刷新缓存），观察投影会按缓存给
    // `legalMoves: []`：客户端只画提示、不画选项，关卡开不了也答不了（P10 实测 B 线卡死）。
    laneState.legalMoves = legalMoves(laneState)
    lanes[lane] = laneState
  }
  const parallel = {
    lanes,
    awaiting: { A: null, B: null },
    sealed: {},
    // 门禁 10：每个章对只结算一次幕间（advanceParallelPair 的幂等标记）。
    interludeApplied: {},
    startedAt: state.revision ?? 0,
  }
  state.parallel = parallel
  // 容器本身不再走 hub：大厅的局内视图由各线的 laneState 投影（parallelView）。
  state.uiState = 'inScenario'
  state.phase = 'investigation'
  state.status = 'playing'
  state.legalMoves = []
  state.currentSeat = parallelDecisionSeat(state) ?? 0
  return { ok: true, lanes: LANES.map(lane => lanes[lane].scenario?.id ?? null), seats: parallelActingSeats(state) }
}

/**
 * 某条线结算完成（大厅在 applyMove 后检测 laneState.uiState === 'scenarioResult' 时调用）：
 * 记下它等待的章对；两条线都等到同一对时返回 `sealed: true`（调用方负责推进/幕间）。
 */
export function markLaneFinished(state, lane, pairId = null) {
  if (!isParallelState(state)) throw new Error('不是并行双运行时状态')
  const laneState = state.parallel.lanes[lane]
  const pair = pairId ?? (laneState.campaign.scenarioIndex + 1)
  state.parallel.awaiting[lane] = pair
  const other = LANES.find(item => item !== lane)
  const both = state.parallel.awaiting[lane] != null && state.parallel.awaiting[other] === pair
  if (both) state.parallel.sealed[pair] = { revision: state.revision ?? 0 }
  return { lane, pair, sealed: both, awaiting: { ...state.parallel.awaiting } }
}

/** 封盘后两条线一起推进到下一章（幕间 → 下一关）；返回每条线的状态。 */
export function advanceParallelPair(state, pairId) {
  if (!isParallelState(state)) throw new Error('不是并行双运行时状态')
  if (!state.parallel.sealed[pairId]) return { ok: false, reason: 'not-sealed' }
  state.parallel.interludeApplied ||= {}
  // 门禁 10：同一 pairId 的封盘 + 幕间只结算一次；重复调用/读档/重连直接 no-op。
  if (state.parallel.interludeApplied[pairId]) {
    return { ok: true, alreadyApplied: true, pairId, advanced: {} }
  }
  const advanced = {}
  for (const lane of LANES) {
    const laneState = state.parallel.lanes[lane]
    // P9.5：并行 lane 结算后仍在线内密集座位（不恢复容器全座），关间/幕间按 lane seam 0..n-1 确认。
    const laneSeats = laneState.investigators.map(inv => inv.seat)
    try {
      // 结算台面 → 关间；两条线都封盘后才一起推进（先确认各席位再开下一章）。
      applyMove(laneState, 0, { action: 'hubContinue' })
      // 真实 TDE 的单线幕间 I 是 2–3 个连续 interlude 节点，每个节点都要全桌确认一次；
      // 逐节点循环推进直到回到 scenarioSetup（有界，防止内容循环把大厅卡死）。
      for (let round = 0; round < 40 && laneState.uiState === 'interlude'; round += 1) {
        for (const seat of laneSeats) {
          if (laneState.uiState !== 'interlude') break
          if (laneState.hubSeatDone?.[seat]) continue
          applyMove(laneState, seat, { action: 'hubDoneSeat' })
        }
      }
      if (laneState.uiState !== 'scenarioSetup') applyMove(laneState, 0, { action: 'hubBeginScenario' })
      // 幕间读完会落到下一关的整备窗口（scenarioSetup，hubReady=false）：本线各座位确认准备后开局。
      for (let round = 0; round < 8 && laneState.uiState === 'scenarioSetup' && !laneState.hubReady; round += 1) {
        for (const seat of laneSeats) {
          if (laneState.hubSeatDone?.[seat]) continue
          try {
            applyMove(laneState, seat, { action: 'hubDoneSeat' })
          } catch {
            // 该座位此刻不可确认（AI/缺牌组）就跳过；若全员都确认不了，下面的开局会明确报错。
          }
        }
      }
      if (laneState.uiState === 'scenarioSetup') applyMove(laneState, 0, { action: 'hubBeginScenario' })
      state.parallel.awaiting[lane] = null
      advanced[lane] = { scenarioId: laneState.scenario?.id ?? null, uiState: laneState.uiState }
    } catch (error) {
      advanced[lane] = { error: error.message }
    }
  }
  const ok = Object.values(advanced).every(item => !item.error)
  if (ok) {
    state.parallel.interludeApplied[pairId] = { revision: state.revision ?? 0 }
    state.revision = (state.revision ?? 0) + 1
  }
  return { ok, pairId, advanced }
}
