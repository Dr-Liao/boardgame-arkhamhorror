import { isDraftMode, startInitialDraft, applyDraftMove } from '../deck/draft-mode.js'
// 行动分派（applyMove / executeCommand / executeAction / executeHubMove / applyMoveUnchecked）
// 从 engine.js 拆出的模块（Phase 6 · 6d-19）。
//
// 这一组是「一条合法行动如何落到具体结算函数」的调度层：
//   applyMove → executeCommand →（关间？executeHubMove ：executeAction → 具体 do*）
// 它本身不含规则，只做「校验通过后分发」与「动作级事件的统一记录」。
// 拆开后 engine.js 的顶层只剩：状态机（阶段）、各个 do*、以及能力层 api。
//
// 依赖注入同前；被依赖表引用的 do* 与本模块函数都用函数声明 + 惰性装配。

import { investigatorRule } from '../cards/card-rules.js'
import { cardPoolContext } from '../deck/card-pool.js'

import { isParleyDescriptor } from './parley.js'
// P8：世界地图启程 / 状况报告（《绯红密钥》）的局外动作。
// 引擎不 import 内容模块：地图图结构、目的地→流程节点、节点 id 与强制终点都从战役清单读；
// 记录同步通过重演 `map` 节点声明的 embark 效果完成（内容层 syncMapRecords + 排队状况报告）。
import { enterCampaignNode } from '../campaign/campaign-flow.js'
import { applyCampaignEffect } from '../campaign/campaign-effects.js'
import { FORCED_TIME_THRESHOLD, forcedDestination, mapTime, mergeMapTime, statusReportState, travelTo, useExpeditedTicket, worldMapState } from './tsk-map.js'
// P8：定制升级卡（Customizable）的关间勾选。勾选校验/经验结算完全复用 tsk-customizable 原语，
// dispatch 只负责「房主 + 相位 + 牌组归属」的越权校验、经验扣减与日志（与 hubPurchase 同口径）。
import { customizationOptions, customizationsOfSeat, upgradeCustomization } from './tsk-customizable.js'
// 暂存升级草稿时的「有效记录」口径与 campaign.js#upgradeRecord 一致（不在这里重写一遍）。
import { upgradeRecord } from '../campaign/campaign.js'
// 第 5 步 P6：法术专用额外行动的算术在 spell-actions.js（纯函数，无依赖）。
// P6（食梦者）：受限行动的算术与 kind 判定分别在 restricted-actions.js / table-decisions.js。
import { spellOnlyActionsOf } from './spell-actions.js'
import { discardRevealedDeckTopWeakness, sampleRoundEvents } from './eote-investigator-support.js'
import {
  actionsAvailable as restrictedActionsAvailable, consumeAction as consumeRestrictedAction,
} from './restricted-actions.js'

import { MODE_LABELS, assignSeatPart, campaignPartsManifest, defaultPartLeads, describeModePlan, laneBalance, modePlan } from '../campaign/campaign-modes.js'
import { createPartsState, inPart, moveSeatRecordToPart, setPart } from '../campaign/campaign-parts.js'
import { partOfScenario } from '../campaign/part-flow.js'
import { enterLaneRuntime, leaveLaneRuntime } from './lane-runtime.js'
import { createEffect } from './effect-state.js'
import { nextInstanceId } from './rules-state.js'
import { flipVeiledLocation } from './veiled.js'
import { cardDef, cardName } from './card-lookup.js'
import { beginAsIf, endAsIf } from './as-if-location.js'
import { discardSpawnedEnemy, spawnHiddenEnemy, takeHiddenEnemyFromHand } from './hidden-enemy.js'
import { recordPerformedAction } from './action-history.js'
import { preparePlayAttempt } from './play-attempt.js'
// ---------------------------------------------------------------------------
// P8：世界地图启程 / 状况报告（战役级 hub 动作）
// ---------------------------------------------------------------------------
// 与参考实现 `CampaignSpecificStep "embark"` / `CampaignSpecific "travel"` / `"statusReport"` 同顺序：
//   选择目的地 → 校验（强制终点 / 解锁 / 快捷旅票）→ 记时间与当前位置 → 进入目的地的流程节点
//   → 由 `progressCampaign` 停在章节准备（scenarioSetup）或幕间（interlude）。
// 近似逐条披露（approximation）：
//   1. 快捷旅票（清单 `expeditedTicketCode`）是「永久」剧情卡：真实路线由幕间把卡放进战役牌组，
//      场景内它在场上（assets）。hub 窗口没有 `state.scenario`，因此不使用卡条目的
//      `scenarioFlags.tskExpeditedTicketUsed` 能力，而是按同一规则从战役牌组/手牌/场上移除该卡并
//      递减 `records.expeditedTickets`；场景内的条目能力路径保持不变。
//   2. 时间/当前位置/已访问记录不复制内容层逻辑：旅行后重演 `map` 节点声明的 `embark` 效果
//      （`applyCampaignEffect` → 内容处理器 `syncMapRecords` + `queueStatusReports`）。
//   3. 时间达到强制阈值时，只允许启程前往清单的 `forcedEndgameNode`（与 `tsk-map#travelTo` 一致）。
//   4. 状况报告正文与效果仍由内容处理器的 statusReport 节点结算；dispatch 只负责进入清单映射的
//      节点并推进流程（不复制任何报告效果）。
const MAP_WINDOW_STATES = Object.freeze(['interlude', 'scenarioSetup'])

/** 校验「房主 + 地图窗口 + 当前 flow 节点 = 清单 map 节点」。 */
function requireWorldMapPhase (state, seat, manifest) {
  if (seat !== 0) throw new Error('只有房主可以决定世界地图启程')
  if (!MAP_WINDOW_STATES.includes(state.uiState)) throw new Error('当前不在世界地图启程窗口')
  const nodeId = state.campaign?.flow?.nodeId
  if (!nodeId) throw new Error('当前战役流程不在世界地图节点')
  if (manifest.mapNodeId && manifest.mapNodeId !== nodeId) throw new Error('当前战役流程不在世界地图节点')
  const node = manifest.flow?.nodes?.[nodeId]
  if (!node || node.type !== 'map') throw new Error('当前战役流程节点不是世界地图')
  if (!Array.isArray(manifest.worldMapGraph?.nodes) || !manifest.worldMapGraph.nodes.length) {
    throw new Error('战役没有可用的世界地图图结构')
  }
  return node
}

/** 强制目的地：地图原语 + 清单阈值/节点兜底（阈值由内容声明，不在引擎写死 35）。 */
function forcedMapDestination (state, manifest) {
  const forced = forcedDestination(state)
  if (forced) return forced
  const limit = Number.isSafeInteger(manifest.forcedEndgameTime) ? manifest.forcedEndgameTime : null
  if (limit != null && mapTime(state) >= limit) return manifest.forcedEndgameNode || null
  return null
}

/** 持票座位（战役牌组 / 手牌 / 场上 / 记录计数，与 hub.js 同口径）。 */
function expeditedTicketHolder (state, manifest) {
  const code = manifest.expeditedTicketCode
  if (!code) return null
  for (const record of Object.values(state.campaign?.investigators || {})) {
    if (record?.status && record.status !== 'active') continue
    if (Array.isArray(record?.deck) && record.deck.includes(code)) return { seat: record.seat, source: 'deck' }
  }
  for (const inv of state.investigators || []) {
    if (Array.isArray(inv.hand) && inv.hand.includes(code)) return { seat: inv.seat, source: 'hand' }
    if (Array.isArray(inv.assets) && inv.assets.some(asset => asset?.code === code)) return { seat: inv.seat, source: 'assets' }
  }
  if (Number(state.campaign?.records?.expeditedTickets) > 0) return { seat: state.campaign?.leadSeat ?? 0, source: 'record' }
  return null
}

/** 放逐快捷旅票：从牌组/手牌/场上移除该卡并递减战役记录计数（见上方 approximation 1）。 */
function exileExpeditedTicket (state, manifest, events, info) {
  const code = manifest.expeditedTicketCode
  const campaign = state.campaign
  let removedFrom = null
  for (const record of Object.values(campaign?.investigators || {})) {
    if (!Array.isArray(record?.deck)) continue
    const index = record.deck.indexOf(code)
    if (index < 0) continue
    record.deck.splice(index, 1)
    if (Array.isArray(record.removedCards)) {
      record.removedCards.push({ code, reason: '启程（快捷旅票）', scenarioIndex: campaign.scenarioIndex })
    }
    removedFrom = 'deck'
    break
  }
  if (!removedFrom) {
    for (const inv of state.investigators || []) {
      const hand = Array.isArray(inv.hand) ? inv.hand : []
      const handIndex = hand.indexOf(code)
      if (handIndex >= 0) {
        hand.splice(handIndex, 1)
        removedFrom = 'hand'
        break
      }
      const assets = Array.isArray(inv.assets) ? inv.assets : []
      const assetIndex = assets.findIndex(asset => asset?.code === code)
      if (assetIndex >= 0) {
        assets.splice(assetIndex, 1)
        removedFrom = 'assets'
        break
      }
    }
  }
  const records = campaign?.records
  if (records && Number(records.expeditedTickets) > 0) {
    records.expeditedTickets = Number(records.expeditedTickets) - 1
  }
  const where = removedFrom === 'deck' ? '战役牌组' : removedFrom === 'hand' ? '手牌' : removedFrom === 'assets' ? '场上' : null
  info(state, events, where
    ? `🎫 快捷旅票已放逐（${where}）：本次启程在剧本日志记 1 时间。`
    : '🎫 快捷旅票已放逐：本次启程在剧本日志记 1 时间。')
}

/**
 * 旅行后同步战役记录并排队状况报告：重演 `map` 节点声明的效果（不复制内容层逻辑）。
 * 内容层没声明 effects 时只记录一条提示，不静默丢失记录同步。
 */
function afterWorldMapTravel (state, manifest, events, info) {
  const mapNode = manifest.flow?.nodes?.[manifest.mapNodeId]
  const effects = Array.isArray(mapNode?.effects) ? mapNode.effects : []
  if (!effects.length) {
    info(state, events, '🌍 世界地图已移动，但战役清单没有声明 map 节点效果：记录未同步。')
    return
  }
  for (const effect of effects) {
    applyCampaignEffect(state, effect, text => info(state, events, text))
  }
}

/**
 * 进入目的地对应的流程节点并推进到下一个停点（章节准备 / 幕间 / 尾声）。
 * 目的地→节点映射由清单 `travelNodes` 提供；终章入口用 `endgameApproachNodeId` 兜底。
 */
function enterWorldMapDestination (state, manifest, destination, events, progressCampaign) {
  const campaign = state.campaign
  const target = manifest.travelNodes?.[destination]
    || (destination === manifest.forcedEndgameNode ? manifest.endgameApproachNodeId : null)
  if (!target) throw new Error(`地图节点 ${destination} 没有对应的战役流程节点`)
  if (!manifest.flow?.nodes?.[target]) throw new Error(`地图节点 ${destination} 的流程节点 ${target} 不存在`)
  delete campaign.pendingNode
  delete campaign.pendingNextIndex
  enterCampaignNode(campaign, manifest, target)
  progressCampaign(state, events, false)
  settleCampaignHubWindow(state, manifest)
}

/**
 * 与 `hubContinue` 的后处理同口径：重新打开该停点的准备/幕间窗口。
 * 章节停点回到 scenarioSetup（各座位确认后房主开始关卡）；幕间/地图停点回到 interlude。
 */
function settleCampaignHubWindow (state, manifest) {
  if (state.status !== 'playing') return
  const campaign = state.campaign
  const stage = campaign.flowStage
  if (!['interlude', 'checkpoint', 'scenario', 'map'].includes(stage)) return
  const scenarioSetup = stage === 'scenario'
  campaign.phase = scenarioSetup ? 'scenarioSetup' : 'interlude'
  state.uiState = campaign.phase
  state.phase = campaign.phase
  state.currentSeat = 0
  state.hubReady = false
  state.hubSeatDone = {}
  state.hubUpgradedSeats = {}
  delete state.hubReplacementSeats
  state.hubSelectedScenarioId = manifest.scenarioIds?.[campaign.scenarioIndex] ?? state.hubSelectedScenarioId
}

export function createDispatch(deps) {
  const {
    ALL_CARDS,
    ALL_INVESTIGATORS,
    abilityApi,
    EFFECTS,
    ScenarioEnded,
    ScenarioRestarted,
    abilityOfMove,
    actionCost,
    actionKind,
    isSpellAction,
    restrictedKindOfMove,
    advanceAct,
    advanceInvestigator,
    aliveInvestigators,
    assetEffect,
    basicWeaknessPool,
    buildDeck,
    buildDeckFromList,
    campaignDiscardOnYourOwn,
    campaignFor,
    captureTableState,
    cardKeyword,
    checkAct,
    checkDefeated,
    checkOutcome,
    chooseAttack,
    controlledAbilityCard,
    corePlayerPool,
    availablePlayerPool,
    getCurrentActionKind,
    setCurrentActionKind,
    setCurrentSpellAction,
    setCurrentRestrictedKind,
    doAbility,
    doEntityAbility,
    doBreakDoor,
    doDiscardThreat,
    doDraw,
    doDrawCultist,
    doEndTurn,
    doEngage,
    doEvade,
    doExplore,
    doFight,
    doFreeAction,
    doHiddenAction,
    doInterruptRitual,
    doInvestigate,
    doLocationAbility,
    doMove,
    doParley,
    doParleyCultist,
    doParleyLita,
    doPayDebt,
    doPlay,
    doPurgeThreat,
    doResign,
    doResource,
    doSacrificeLita,
    doSearchIzzie,
    doShortcutMove,
    doDetachLocationAttachment,
    endCampaign,
    enemiesEngagedWith,
    enemyAttack,
    enemyCanOpportunityAttack,
    // 2026-11-01：演出快照里的敌人派生数值（有效生命/战斗/躲避）要与实时观察同口径，
    // 否则演出播放期间牌桌按快照重绘会退回印刷值（01175 等卡面修正看不到）。
    enemyEvadeValue,
    enemyFightValue,
    enemyHealth,
    // 2026-10-28 调试控制台（CONTRACT §3）：由 engine.js 注入的调试执行器。
    executeDebugMove,
    finishUpgradeDraft,
    getMaxSanity,
    getStat,
    hubActingSeats,
    hubPendingSeats,
    // 2026-10-27 修复 05002：直觉牌库揭示牌的折扣值走规则读点（不再写死 2）。
    hunchDeck,
    inHub,
    info,
    performTest,
    initialHubPreparation,
    jakeSkipsOpportunityAttack,
    legalMoves,
    makeInvestigator,
    normalActionsLeft,
    payAndAdvanceAct,
    playFlag,
    playCost,
    // 2026-10-27：如同手牌通道统一取牌（宿主附属 / 直觉牌库 / 银暮匕首下方 / 其余通道片段）。
    playChannels,
    playerWindow,
    progressCampaign,
    randomValue,
    shuffle,
    reactionWindow,
    recommendUpgrade,
    registerCampaignInvestigator,
    registeredEntry,
    reopenReplacementPreparation,
    // 2026-10-25 第六轮修复 05040：行动结束统一清 endOfAction 时长的效果。
    expireEffects,
    resolveTransaction,
    ruleIgnored,
    runInterlude,
    runMulligans,
    scenarioBehavior,
    scenarioRuntime,
    selectInitialHubScenario,
    stagePurchase,
    startScenario,
    syncClues,
    unpaidExtraActionThreats,
    validateMove,
  } = deps

function applyMove(state, seat, move) {
  const error = validateMove(state, seat, move)
  if (error) throw new Error(error)
  // 调试跳关 / 重开本关允许在待决选择存在时直接打断旧事务并重建关卡。
  if (move?.action === 'debug' && move.kind === 'scenario' && (state.pendingChoice || state.continuation)) {
    state.pendingChoice = null
    delete state.continuation
  }
  // 事务会用"本次动作开始前"的快照重建整个 state（见 resolution.js），
  // 所以动作日志必须由这里持有，事务结束后再挂回去。
  const actionLog = state.actionLog || []
  let events
  try {
    events = resolveTransaction(state, seat, move, executeCommand)
  } finally {
    state.actionLog = actionLog
  }
  // 对局级动作日志：重放、撤销与 AI 决策回归都读它（见 src/engine/replay.js）。
  // 只记成功提交的动作；内容是可 JSON 存档的纯数据，不含闭包。
  actionLog.push({ seat, move: { ...move } })
  // 公共线索是个人线索之和的派生值；内容层直接写 inv.clues 时在这里统一收敛，
  // 避免「公共线索 0 / 个人线索 1」导致共同支付与幕推进读错。
  if (!inHub(state) && state.uiState === 'inScenario') syncClues(state)
  state.legalMoves = legalMoves(state)
  if (!inHub(state)) events.push({ type: 'presentation', kind: 'checkpoint', tableState: captureTableState(state, getStat, getMaxSanity, { enemyHealth, enemyFightValue, enemyEvadeValue }) })
  return events
}

// 结局钩子用抛错结束本关或重开本关。调试指令和普通行动都要接住，否则事务会把结算回滚。
function settleScenarioBoundary(state, events, error) {
  if (error instanceof ScenarioRestarted) {
    // 04059 结局 4：重演本场冒险。原地重新布置同一剧本，并重新发起始手牌。
    const index = state.campaign.scenarioIndex
    startScenario(state, index, events)
    runMulligans(state, events)
    info(state, events, '🔁 调查队重组队伍，再次进入遗迹深处。')
    return
  }
  if (!(error instanceof ScenarioEnded)) throw error
  // 关卡结束：先把记录键与座位簿记改回 roomSeat，再进入结算/关间。
  // P9.5：并行 lane 的结算/关间全程留在**线内密集座位**（不离开 laneRuntime）——
  // 并行每条线的关间只有本线座位，若恢复成容器全座会出现「另一线座位无 campaign record、
  // 却仍被算作 pending」的死锁。
  if (!state.parallelLane) leaveLaneRuntime(state)
  if (error.nextIndex == null) {
    if (state.campaign.failed || !state.campaign.pendingNode) endCampaign(state, events)
    else progressCampaign(state, events, false)
  } else if (state.hubFlow) {
    state.campaign.pendingNextIndex = error.nextIndex
    state.campaign.phase = 'scenarioResult'
    state.uiState = 'scenarioResult'
    state.phase = 'scenarioResult'
    state.currentSeat = 0
    state.legalMoves = legalMoves(state)
  } else progressCampaign(state, events, true)
}

function executeCommand(state, seat, move, events) {
  // 调试 move（CONTRACT §3.1）：在局外分支之前分发，完全绕过行动点 / 借机攻击 /
  // 行动类型；校验已由 applyMove → validateMove 完成。
  if (move.action === 'debug') {
    try {
      return executeDebugMove(state, seat, move, events)
    } catch (error) {
      return settleScenarioBoundary(state, events, error)
    }
  }
  if (inHub(state)) {
    executeHubMove(state, seat, move, events)
    return
  }
  if (move.action === 'interlude') {
    runInterlude(state, move.nextIndex, events)
    return
  }
  try {
    executeAction(state, seat, move, events)
  } catch (error) {
    settleScenarioBoundary(state, events, error)
  }
}

function executeAction(state, seat, move, events) {
  if (move.action !== 'play') return executePaidAction(state, seat, move, events)
  const previous = state._prePlayAttempt
  const attempt = preparePlayAttempt(state, state.investigators[seat], move.copyCode || move.cardId, events,
    { playCost, cardDef, reactionWindow, shuffle, randomValue })
  if (attempt.cancelled) return
  state._prePlayAttempt = attempt
  try { return executePaidAction(state, seat, move, events) }
  finally {
    if (previous) state._prePlayAttempt = previous
    else delete state._prePlayAttempt
  }
}

function executePaidAction(state, seat, move, events) {
  if (move.action === 'setup') {
    progressCampaign(state, events, true)
    return
  }
  const inv = state.investigators[seat]
  // Phase 5（5c-39）：谁能回滚这个动作由条目级 rewindAction 决定（手上或附属区里都算）。
  const needsTimeWarpSnapshot = !['endTurn', 'setup', 'interlude'].includes(move.action)
    && aliveInvestigators(state).some(owner => owner.hand.some(code => registeredEntry(code)?.rewindAction === true)
      || owner.assets.some(asset => (asset.attached || []).some(code => registeredEntry(code)?.rewindAction === true)))
  const actionSnapshot = needsTimeWarpSnapshot
    ? structuredClone({ ...state, _resolution: null, pendingChoice: null, legalMoves: [], lastActionSnapshot: null }) : null
  const totalCost = actionCost(state, inv, move, false)
  const cost = actionCost(state, inv, move)
  const kind = actionKind(state, inv, move)
  setCurrentActionKind(kind)
  // 第 5 步 P6：法术专用额外行动（玛丽·朗博）——最后一个行动只能花在法术卡/法术能力上。
  // P6（食梦者）：同一读点也覆盖托尼·摩尔根的「只能用于交战/攻击带赏金敌人」的额外行动。
  const spell = isSpellAction(state, inv, move)
  const restricted = restrictedKindOfMove(state, inv, move)
  setCurrentSpellAction(spell)
  setCurrentRestrictedKind(restricted)
  if (state.immediateAction?.seat === seat && cost > 0) {
    if (cost !== 1) throw new Error('立即行动只能进行一次行动')
  } else if (kind === 'explore') {
    if (inv.actionsLeft < cost) throw new Error('行动点不足')
    const normal = normalActionsLeft(inv)
    inv.actionsLeft -= cost
    if (normal < cost) inv.exploreOnlyActions = Math.max(0, (inv.exploreOnlyActions || 0) - (cost - normal))
  } else {
    if (restrictedActionsAvailable(inv, restricted) < cost) {
      throw new Error(restricted === 'bounty'
        ? '行动点不足（额外行动只能用于交战或攻击带赏金的敌人）'
        : inv.bountyOnlyActions && restricted !== 'bounty'
          ? '行动点不足（额外行动只能用于交战或攻击带赏金的敌人）'
          : spellOnlyActionsOf(inv) && restricted !== 'spell'
            ? '行动点不足（额外行动只能用于探索或法术）'
            : '行动点不足')
    }
    consumeRestrictedAction(inv, cost, restricted)
  }
  inv.exploreOnlyActions = Math.min(inv.exploreOnlyActions || 0, Math.max(0, inv.actionsLeft))
  if (cost > 0) {
    if (state.immediateAction?.seat !== seat) inv.actionsTakenThisTurn = (inv.actionsTakenThisTurn || 0) + 1
    state.phaseActionCount = (state.phaseActionCount || 0) + 1
  }
  if (totalCost > cost || move.action === 'endTurn') inv.tomeActionUsed = true
  state.moveCount++
  const ability = move.action === 'ability' ? assetEffect(inv, controlledAbilityCard(inv, move.assetId))?.abilities?.[move.abilityIndex] : null
  if (totalCost) for (const threat of unpaidExtraActionThreats(state, inv, kind)) {
    threat.extraActionPaidRound = state.round
  }
  const previousResolvingAction = state._resolvingAction
  state._resolvingAction = totalCost > 0 || ability?.descriptor?.kind === 'action'
  state._actionPaid = true
  try {
    if (move.action === 'scenarioAction') scenarioBehavior(state).payScenarioActionCost?.(state, inv, move, scenarioRuntime(state, events))
    const noOpportunityAttack = move.action === 'freeAction' && investigatorRule(inv.code)?.freeAction?.noOpportunityAttack
    // Phase 2（C2）：noOpportunityAttack 也可以由描述子的 add:keyword 授予。
    // Phase 5（5c）：资产把「打出时不引发借机攻击」写成条目级 noOpportunityAttack
    // （旧 DSL 的字段名是 noOpportunityAttackOnPlay），两边都在这里汇合。
    const playNoAoO = move.action === 'play'
      && (playFlag(move.copyCode || move.cardId, 'noOpportunityAttack')
        || cardKeyword(state, inv, move.copyCode || move.cardId, 'noOpportunityAttack'))
    // 行动/能力级豁免（01055 飞贼的 [action]）：只豁免这一次行动，不豁免打出资产本身。
    const usedAbility = ['ability', 'entityAbility'].includes(move.action) ? abilityOfMove(state, inv, move) : null
    const abilityNoAoO = usedAbility?.descriptor?.noOpportunityAttack === true
      || usedAbility?.noOpportunityAttack === true
      // 第 2 步 P2.7：谈判行动按规则不引发借机攻击；非玩家实体的通用行动同理。
      || isParleyDescriptor(usedAbility?.descriptor)
    // 03147 双刃短刀：控制者的「交战」行动不引发借机攻击。
    const engageNoAoO = kind === 'engage'
      && inv.assets.some(item => registeredEntry(item.code)?.engageNoOpportunityAttack === true)
    // 2026-10-25 本循环修复 05228：剧本行动（behavior.actions）可以声明不引发借机攻击，
    // 支持全豁免（noOpportunityAttack: true）与按敌人卡号豁免（noOpportunityAttackFrom: [卡号…]）。
    const scenarioNoAoOAll = move.action === 'scenarioAction' && move.noOpportunityAttack === true
    const exemptions = move.action === 'ability' ? usedAbility?.descriptor?.noOpportunityAttackFrom : move.noOpportunityAttackFrom
    const scenarioNoAoOFrom = Array.isArray(exemptions)
      ? exemptions.map(String)
      : []
    if (totalCost && !noOpportunityAttack && !playNoAoO && !abilityNoAoO && !engageNoAoO && !scenarioNoAoOAll
      && !ruleIgnored(state, inv, 'opportunityAttack')
      && !jakeSkipsOpportunityAttack(state, inv, kind)
      && !['fight', 'evade', 'resign', 'parley', 'parleyCultist', 'parleyLita'].includes(kind) && !['fightConcealed', 'evadeConcealed'].includes(move.action)) {
      const scenarioExempt = enemy => scenarioNoAoOFrom.includes(String(enemy.originalCode || enemy.code))
        || scenarioNoAoOFrom.includes(String(enemy.code))
      const pending = enemiesEngagedWith(state, inv).filter(enemy => !enemy.exhausted
        && enemyCanOpportunityAttack(state, enemy) && !scenarioExempt(enemy)).map(e => e.id)
      while (pending.length) {
        const candidates = pending.map(id => state.enemies.find(e => e.id === id)).filter(e => e && !e.exhausted)
        if (!candidates.length) break
        const enemy = chooseAttack(state, inv, candidates, 'opportunity')
        pending.splice(pending.indexOf(enemy.id), 1)
        if (inv.onTheLam && !enemy.elite) continue
        const opportunity = reactionWindow(state, 'opportunityAttack', {
          when: 'opportunityAttack', seat, location: inv.location, enemy, prompt: `「${enemy.name}」对 ${inv.name} 发动借机攻击`,
        }, events)
        if (opportunity.cancelled) {
          info(state, events, `${inv.name} 取消了「${enemy.name}」的借机攻击。`)
          continue
        }
        enemyAttack(state, enemy, inv, events, enemy.name + ' 发动借机攻击。', { kind: 'opportunity' })
        if (inv.defeated || state.status !== 'playing') break
      }
    }
    if (!inv.defeated && !inv.resigned && state.status === 'playing') {
      state.lastActionSnapshot = actionSnapshot
      applyMoveUnchecked(state, seat, move, events)
      // 「自食其力」（04236）等持续强制：资产入场/换装后立刻检查，而不是等到重整阶段。
      if (!inv.defeated && !inv.resigned) campaignDiscardOnYourOwn(state, inv, events)
      if (state._timeWarped) {
        delete state._timeWarped
        state.lastActionSnapshot = null
        return
      }
      if (move.action !== 'endTurn') {
        if (totalCost > 0) {
          const repeatedActionKinds = recordPerformedAction(state, inv, move, kind, registeredEntry)
          if (repeatedActionKinds.length) reactionWindow(state, 'consecutiveActions', {
            when: 'consecutiveActions', seat, actionKinds: repeatedActionKinds,
            location: inv.location, prompt: `${inv.name} 连续完成了两次同类行动`,
          }, events)
        }
        reactionWindow(state, 'actionResolvedAtLocation', {
          when: 'actionResolvedAtLocation', seat, location: inv.location, prompt: `${inv.name} 完成了一次行动`,
        }, events)
      }
      state.lastActionSnapshot = null
    } else if (state.status === 'playing') advanceInvestigator(state, seat, events)
  } finally {
    delete state._actionPaid
    if (previousResolvingAction === undefined) delete state._resolvingAction
    else state._resolvingAction = previousResolvingAction
  }
}

// 幕间结算留下的「下一场冒险」修正：起始资源 / 起始线索，用一次后清空。

function executeHubMove(state, seat, move, events) {
  const CAMPAIGN = campaignFor(state)
  const campaign = state.campaign
  switch (move.action) {
    case 'hubSetLeader':
      if (!(state.humanSeats || [0]).includes(move.leadSeat)) throw new Error('队长必须由真人玩家担任')
      campaign.leadSeat = move.leadSeat
      campaign.leadConfirmed = true
      if (campaign.partLeads && campaign.currentPart) campaign.partLeads[campaign.currentPart] = move.leadSeat
      info(state, events, `${state.investigators[move.leadSeat].name} 被选为小队队长。`)
      break
    case 'hubSetPartLeader': {
      if (!campaignPartsManifest(campaignFor(state)) || !campaign.seatParts) throw new Error('当前战役没有双线队长')
      const part = move.part
      if (!['A', 'B'].includes(part)) throw new Error(`线必须是 A 或 B：${String(part)}`)
      if (!Number.isInteger(move.leadSeat) || campaign.seatParts[move.leadSeat] !== part) {
        throw new Error(`座位 ${move.leadSeat + 1} 不在 ${part} 线，不能担任该线队长`)
      }
      campaign.partLeads = { ...(campaign.partLeads || {}), [part]: move.leadSeat }
      if (campaign.currentPart === part) campaign.leadSeat = move.leadSeat
      info(state, events, `${state.investigators[move.leadSeat].name} 被选为 ${part} 线队长。`)
      break
    }
    case 'hubSetDifficulty': state.difficulty = move.difficulty; break
    case 'hubSelectScenario':
      if (!selectInitialHubScenario(state, move.scenarioId, events)) state.hubSelectedScenarioId = move.scenarioId
      break
    case 'hubGoSetup': state.uiState = 'scenarioSetup'; state.phase = 'scenarioSetup'; campaign.phase = 'scenarioSetup'; break
    case 'hubSetMode': {
      const plan = modePlan({ mode: move.mode, playerCount: (state.investigators || []).length })
      if (!plan.ok) throw new Error(plan.reason || '该开局模式不可用')
      const created = createPartsState({ mode: plan.mode, seatParts: plan.seatParts, currentPart: plan.currentPart })
      campaign.mode = created.mode
      campaign.seatParts = [...created.seatParts]
      campaign.activeParts = [...created.activeParts]
      campaign.currentPart = created.currentPart
      campaign.parts = {}
      // 双线各自一名队长（默认每条线第一个真人座位）；分选/并行都保留，便于关间切换。
      campaign.partLeads = defaultPartLeads(campaign.seatParts, state.humanSeats || [0])
      campaign.leadConfirmed = true
      campaign.leadSeat = campaign.partLeads[campaign.currentPart || 'A'] ?? campaign.leadSeat
      campaign.scenarioIndex = 0
      // 声明了 parts 的双线 flow 从章对门起步：把 flow 直接定位到首关（a1/b1），
      // 这样 hub 的「选择第一关」与后续 hubBeginScenario 都能读到 scenario 节点。
      const order = campaignFor(state).scenarioOrder || []
      const first = order[0] ?? null
      state.hubSelectedScenarioId = first
      if (first && campaignPartsManifest(campaignFor(state))) selectInitialHubScenario(state, first, events)
      state.hubSeatSelected = {}
      state.hubSeatDone = {}
      state.hubUpgradedSeats = {}
      info(state, events, `开局模式：${MODE_LABELS[plan.mode]?.label || plan.mode}。${describeModePlan(plan)}`)
      break
    }
    case 'hubSetSeatPart': {
      if (!['pick', 'parallel'].includes(campaign.mode)) throw new Error('只有分选/并行双线允许手动改线')
      if (campaign.scenarioResults.length) throw new Error('已经开始游戏，不能再改线')
      // 并行：玩家只能换自己的座位；房主只能代操作 AI 座位（不能替其他真人换线）。
      // 分选保留旧口径：座位 1 可替全桌调整。
      if (campaign.mode === 'parallel') {
        const humans = state.humanSeats || [0]
        const self = seat === move.seat
        const hostForAi = seat === 0 && !humans.includes(move.seat)
        if (!self && !hostForAi) throw new Error('房主只能代 AI 换线；真人请用自己的换位置按钮')
      } else if (seat !== move.seat && seat !== 0) throw new Error('只能改自己座位的线')
      const trial = assignSeatPart({ mode: campaign.mode, seatParts: campaign.seatParts, seat: move.seat, part: move.part })
      if (!trial.ok) throw new Error(trial.reason)
      const previousPart = campaign.seatParts?.[move.seat] ?? null
      campaign.seatParts = [...trial.seatParts]
      // P9.5：先保存牌组、后改线时把该座位的战役记录搬到新线，避免「新线没有合法牌组」。
      if (previousPart) moveSeatRecordToPart(campaign, move.seat, previousPart, move.part)
      // 换线后如果某线队长被换走，默认改回该线第一个真人座位。
      if (campaign.partLeads) {
        for (const part of ['A', 'B']) {
          const seatInPart = campaign.seatParts[campaign.partLeads[part]] === part
          if (!seatInPart) campaign.partLeads[part] = defaultPartLeads(campaign.seatParts, state.humanSeats || [0])[part]
        }
      }
      const balance = laneBalance(campaign.seatParts)
      const tail = campaign.mode === 'parallel'
        ? `（A ${balance.A} / B ${balance.B}${balance.balanced ? '，人数相等' : '，人数还不相等，不能开始'}）`
        : ''
      info(state, events, `座位 ${move.seat + 1} 改到 ${move.part} 线${tail}。`)
      break
    }
    case 'hubSelectInvestigator': {
      const select = () => {
        const previous = campaign.investigators[seat]
        if (previous?.status === 'active' && !initialHubPreparation(state)) throw new Error('现役调查员不能更换；只有死亡或疯狂后才能挑选替补')
        if (previous?.status === 'active' && previous.code !== move.code) {
          // Before the first scenario the player may reconsider their investigator.
          // Keep the already generated basic weakness, but require a new legal deck
          // so repeatedly previewing investigators cannot reroll that weakness.
          previous.code = move.code
          previous.name = ALL_INVESTIGATORS[move.code].nameZh || ALL_INVESTIGATORS[move.code].name
          previous.deck = previous.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
          previous.startingDeckReady = false
        } else if (previous && previous.status !== 'active') {
          campaign.retired.push(structuredClone(previous))
          delete campaign.investigators[seat]
          // 关间替补：新调查员的 0 XP 起始牌组在确认席位前仍可反复调整（自动构筑/手动/
          // 卡组库/ArkhamDB）。只标记本关间换人的席位，现役调查员仍不能在关间重建牌组。
          // 两关直接相邻时换人发生在下一关的 scenarioSetup 窗口，与幕间同口径。
          if (state.uiState === 'interlude' || state.uiState === 'scenarioSetup') {
            state.hubReplacementSeats = { ...(state.hubReplacementSeats || {}), [seat]: true }
          }
        }
        state.investigators[seat] = makeInvestigator(ALL_INVESTIGATORS[move.code], seat)
        if (campaign.investigators[seat]) state.investigators[seat].campaignId = campaign.investigators[seat].id
        state.hubSeatSelected[seat] = true
        if (isDraftMode(state)) startInitialDraft(state, seat)
      }
      const part = campaign.seatParts?.[seat]
      if (isDraftMode(state) && part && part !== campaign.currentPart) inPart(state, part, select)
      else select()
      break
    }
    case 'hubResumeDraft':
      state.hubSeatDone[seat] = false
      state.hubReady = false
      state.uiState = state.phase = campaign.phase = 'interlude'
      state.currentSeat = seat
      break
    case 'hubDraftRefill':
    case 'hubDraftPick':
    case 'hubDraftBuy':
    case 'hubDraftRefresh':
    case 'hubDraftLock':
      {
        const part = campaign.seatParts?.[state.laneRuntime?.roomSeats?.[seat] ?? seat]
        if (part && part !== campaign.currentPart) inPart(state, part, () => applyDraftMove(state, seat, move))
        else applyDraftMove(state, seat, move)
      }
      break
    case 'hubAutoDeck':
    case 'hubSetDeck': {
      const inv = state.investigators[seat]
      const built = move.action === 'hubSetDeck'
        ? buildDeckFromList(ALL_INVESTIGATORS[inv.code], move.codes,
          { seat, seed: Math.floor(randomValue(state) * 4294967296), playerPool: availablePlayerPool(state), basicWeaknessPool: basicWeaknessPool(state) })
        : buildDeck(ALL_INVESTIGATORS[inv.code], {
          seat, seed: Math.floor(randomValue(state) * 4294967296), playerPool: corePlayerPool(state),
        })
      if (built.errors?.length) throw new Error(`牌组无效：${built.errors.join('；')}`)
      // P5 批次 2：非活动线座位的 campaign record 写进该线快照（parts[part]），
      // 活动线仍写顶层；两条线共用同一个 record 形状，靠 inPart 换数据作用域。
      const saveDeck = () => {
        const existing = campaign.investigators[seat]
        if (existing) {
          // Editing or rebuilding a starting deck keeps the generated basic
          // weakness and identity while replacing investigator-specific cards.
          const retained = existing.deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness')
          existing.code = inv.code
          existing.name = inv.name
          existing.deck = [...built.playerCards, ...built.signatureCards, ...built.signatureWeaknesses,
            ...(retained.length ? retained : built.basicWeaknesses)].sort()
          existing.startingDeckReady = true
        } else {
          const created = registerCampaignInvestigator(campaign, inv, built.deck)
          created.startingDeckReady = true
        }
      }
      const lanePart = state.campaign.seatParts?.[seat]
      if (lanePart && lanePart !== campaign.currentPart) inPart(state, lanePart, saveDeck)
      else saveDeck()
      inv.autoBuilt = move.action === 'hubAutoDeck'
      if (inv.autoBuilt) info(state, events, `${inv.name}：按调查员属性与卡牌能力评分组牌，并通过尺寸、职业、等级、限额、重复张数和 0 XP 预算检查；签名卡与随机基础弱点另行加入。`)
      info(state, events, `${inv.name} 的战役牌组已保存。`)
      break
    }
    case 'hubPurchase': {
      const purchase = stagePurchase(campaign, seat, move.added, move.removed, cardPoolContext(state))
      info(state, events, `${state.investigators[seat].name} 暂存升级（${purchase.cost} XP），等待确认。`)
      break
    }
    case 'hubCustomize': {
      // P8：定制升级卡的一格勾选（房主代全桌执行，与 hubContinue/hubEmbark 同一房主口径）。
      // 越权/相位校验在这里；勾选合法性、经验充分性与写入由 tsk-customizable 原语负责。
      if (seat !== 0) throw new Error('只有房主可以执行定制升级')
      if (state.uiState !== 'interlude'
        && !(state.uiState === 'scenarioSetup' && !campaign.scenarioResults?.length)) {
        throw new Error('定制升级只能在关间或首章前的构筑准备中进行')
      }
      if (campaign.upgradesAllowed === false) throw new Error('本次关间不允许升级')
      const record = campaign.investigators[seat]
      if (!record || record.status !== 'active') throw new Error('当前座位没有可升级的调查员')
      // 未保存的升级草稿把经验暂存在草稿记录上；先保存/撤销，避免两套账重复扣减。
      if (record.upgradeDraft) throw new Error('请先保存或撤销本轮升级方案，再进行定制升级')
      const code = typeof move.code === 'string' ? move.code : ''
      const optionList = customizationOptions(code)
      if (!optionList) throw new Error(`卡牌 ${code || '?'} 没有注册定制选项`)
      if (!(record.deck || []).includes(code)) throw new Error(`「${cardName(code)}」不在该调查员的战役牌组中`)
      const optionIndex = Number(move.optionIndex)
      if (!Number.isSafeInteger(optionIndex) || optionIndex < 0 || optionIndex >= optionList.length) {
        throw new Error(`定制选项下标无效：${String(move.optionIndex)}`)
      }
      const option = optionList[optionIndex]
      const checked = [...(customizationsOfSeat(state, seat)[code] || [])]
      const filled = checked.filter(index => index === optionIndex).length
      if (filled >= option.checks) throw new Error(`「${option.name}」已经勾满 ${option.checks} 格`)
      checked.push(optionIndex)
      const availableXp = Math.max(0, Number(upgradeRecord(record)?.xp) || 0)
      // 原语只校验/结算，不写 `record.xp`；这里扣一次（hubPurchase 经 purchaseCard 扣一次，同一口径）。
      const result = upgradeCustomization(state, { seat, code, checked, availableXp, costPerCheck: 1 })
      record.xp -= result.xpCost
      record.spentXp = (record.spentXp || 0) + result.xpCost
      campaign.xp = Object.values(campaign.investigators).reduce((sum, item) => sum + item.xp, 0)
      info(state, events, `定制升级：${cardName(code)} · ${option.name} 第 ${filled + 1} 格（-${result.xpCost} XP）`)
      break
    }
    case 'hubConfirmUpgrades': finishUpgradeDraft(campaign, seat, true); break
    case 'hubCancelUpgrades': finishUpgradeDraft(campaign, seat, false); break
    case 'hubAutoUpgrade': {
      const advice = recommendUpgrade(campaign.investigators[seat], campaign.records, cardPoolContext(state))
      campaign.investigators[seat].upgradeAdvice = advice
      if (advice.added) {
        stagePurchase(campaign, seat, advice.added, advice.removed, cardPoolContext(state))
        finishUpgradeDraft(campaign, seat, true)
      }
      state.hubUpgradedSeats[seat] = true
      info(state, events, state.investigators[seat].name + '：' + advice.reason)
      break
    }
    case 'hubDoneSeat': {
      state.hubSeatDone[seat] = true
      // 席位确认后关间不再开放起始牌组重构（与首关准备一致）。
      if (state.hubReplacementSeats) {
        delete state.hubReplacementSeats[seat]
        if (!Object.keys(state.hubReplacementSeats).length) delete state.hubReplacementSeats
      }
      if (hubPendingSeats(state).length) state.currentSeat = hubActingSeats(state)[0]
      else {
        state.currentSeat = 0
        state.hubReady = true
        if (state.uiState === 'interlude') {
          progressCampaign(state, events, false, true)
        }
      }
      break
    }
    case 'hubReopenSetup':
      state.hubReady = false
      state.hubSeatDone = {}
      state.currentSeat = 0
      info(state, events, '首关尚未开始，已重新开放调查员、牌组与席位准备。')
      break
    case 'hubBeginScenario': {
      // P9.5：并行 lane 内部运行时由 mod 边界选定队长（线队长可以是 AI），不再要求真人。
      const humanLead = state.laneRuntime ? true : (state.humanSeats || [0]).includes(campaign.leadSeat)
      if (!campaign.leadConfirmed || !humanLead) throw new Error('请先选择一名真人玩家担任队长')
      // P5 批次 3：单线与分选在进入关卡前切到目标线的运行时（密集线内座位）；并行仍需双运行时
      // 容器接线，先用明确原因挡住，避免把两条线塞进一个运行时。
      const manifest = campaignFor(state)
      const parts = campaignPartsManifest(manifest)
      if (parts && campaign.mode === 'parallel') {
        throw new Error('并行双线由大厅边界启动（mod.applyMove）；纯引擎不直接开局')
      }
      if (!state.hubReady || state.hubSelectedScenarioId !== CAMPAIGN.scenarioOrder[campaign.scenarioIndex]) {
        throw new Error('关卡尚未解锁或队伍尚未准备')
      }
      // 旧存档兼容：两关直接相邻（中间没有幕间节点）时，更新前的版本会带着上一轮的
      // 「全队已就绪」直接落到下一关准备。若队伍里有阵亡/疯狂但还没换人的席位，先重新打开
      // 席位准备窗口，交给关间替补流程换人；否则会带着非现役战役身份开局并在
      // prepareInvestigator 抛「调查员战役身份不可进入剧本」。
      if (reopenReplacementPreparation(state).length) {
        info(state, events, '有调查员已经阵亡或疯狂：请先挑选替补调查员并确认准备，再开始关卡。')
        break
      }
      if (parts && campaign.mode) {
        const part = partOfScenario(manifest.parts, state.hubSelectedScenarioId)
        if (part && campaign.currentPart !== part) setPart(state, part)
        enterLaneRuntime(state)
      }
      progressCampaign(state, events, true)
      break
    }
    case 'hubContinue': {
      delete campaign.pendingNextIndex
      progressCampaign(state, events, false)
      if (state.status !== 'playing') break
      if (state.campaign.flowStage !== 'interlude' && state.campaign.flowStage !== 'checkpoint') break
      campaign.phase = 'interlude'
      state.uiState = 'interlude'
      state.phase = 'interlude'
      state.currentSeat = 0
      state.hubReady = false
      state.hubSeatDone = {}
      state.hubUpgradedSeats = {}
      // 新关间从零开始：替换席位标记只在换人的那一轮关间有效。
      delete state.hubReplacementSeats
      state.hubSelectedScenarioId = CAMPAIGN.scenarioOrder[campaign.scenarioIndex]
      break
    }
    case 'hubEmbark': {
      // P8：世界地图启程（房主）。目的地→流程节点走清单 travelNodes；时间/位置记录由 map 节点的
      // embark 效果同步（内容层），dispatch 只负责校验、旅行与推进流程。
      requireWorldMapPhase(state, seat, CAMPAIGN)
      const graph = CAMPAIGN.worldMapGraph
      const destination = typeof move.destination === 'string' ? move.destination : ''
      if (!destination) throw new Error('启程需要目的地')
      if (move.expedite !== undefined && typeof move.expedite !== 'boolean') throw new Error('expedite 必须是布尔值')
      const expedite = move.expedite === true
      const forced = forcedMapDestination(state, CAMPAIGN)
      const pending = statusReportState(state)?.pending || []
      if (forced != null) {
        if (expedite) throw new Error('被迫启程不能使用快捷旅票')
        if (destination !== forced) throw new Error(`时间已达强制终局阈值，只能启程前往 ${forced}`)
      } else if (pending.length) {
        throw new Error(`请先结算状况报告 ${String(pending[0]).toUpperCase()}`)
      }
      // P8：章节结局的时间奖励写在 records.time（战役记录），地图时间只随旅行累加。
      // 启程前先把两者归并成同一时间轴，再累计本次旅行耗时；否则章节奖励会在回地图时被覆盖。
      {
        const merged = mergeMapTime(state, campaign.records?.time ?? 0)
        if (campaign.records) campaign.records.time = merged
      }
      let travel
      if (expedite) {
        if (!expeditedTicketHolder(state, CAMPAIGN)) throw new Error('没有可用的快捷旅票')
        // 内容条目必须声明启程能力（flags/assetRule.expeditedTicket），放逐才不是凭空删卡；
        // 时间 1 与 `tsk-map#useExpeditedTicket` 同一原语（卡面规则），见文件头 approximation 1。
        const ticketEntry = registeredEntry(CAMPAIGN.expeditedTicketCode)
        if (!ticketEntry?.flags?.expeditedTicket && !ticketEntry?.assetRule?.expeditedTicket) {
          throw new Error('快捷旅票条目未声明启程能力（flags/assetRule.expeditedTicket）')
        }
        travel = useExpeditedTicket(state, { graph, destination })
        exileExpeditedTicket(state, CAMPAIGN, events, info)
      } else {
        travel = travelTo(state, { graph, destination })
      }
      const arrived = travel?.to || destination
      afterWorldMapTravel(state, CAMPAIGN, events, info)
      // 2026-11-13 P1-17：时间跨过 35（或出发前已到点）强制启程时，先把排队中的状况报告结算掉，
      // 尤其是 Ω——此前 hub 只给强制启程、跳过 pending 校验，Ω 永远留队（终章少 1 枚 cultist、
      // 正文不可见）。参考 Helpers.hs#markTime：先播达到阈值的报告，再强制启程进终章（同一动作内完成）。
      if (travel?.forced === true) {
        for (let guard = 0; guard < 4; guard += 1) {
          const pendingReports = statusReportState(state)?.pending || []
          const report = pendingReports.find(id => CAMPAIGN.statusReportNodes?.[id])
          if (!report) break
          delete campaign.pendingNode
          delete campaign.pendingNextIndex
          enterCampaignNode(campaign, CAMPAIGN, CAMPAIGN.statusReportNodes[report])
          info(state, events, `📻 时间到达 ${FORCED_TIME_THRESHOLD}：先阅读状况报告 ${String(report).toUpperCase()}。`)
          progressCampaign(state, events, false)
          settleCampaignHubWindow(state, CAMPAIGN)
        }
      }
      info(state, events, `🧳 启程：${arrived}（耗时 ${travel?.cost ?? '?'} 时间，当前时间 ${travel?.time ?? '?'}）。`)
      enterWorldMapDestination(state, CAMPAIGN, arrived, events, progressCampaign)
      break
    }
    case 'hubAdvanceReport': {
      // P8：结算一份到期待处理的状况报告。进入清单映射的 statusReport 节点，由内容处理器的
      // statusReport 效果结算（正文/混乱袋/解锁/夺钥），随后 walkCampaign 回到 worldMap。
      requireWorldMapPhase(state, seat, CAMPAIGN)
      const pending = statusReportState(state)?.pending || []
      const report = typeof move.report === 'string' && move.report ? move.report : pending[0]
      if (!report) throw new Error('没有待处理的状况报告')
      if (!pending.includes(report)) throw new Error(`状况报告 ${report} 不在待处理队列`)
      const nodeId = (typeof move.nodeId === 'string' && move.nodeId) || CAMPAIGN.statusReportNodes?.[report]
      if (!nodeId || !CAMPAIGN.flow?.nodes?.[nodeId]) throw new Error(`状况报告 ${report} 没有对应的流程节点`)
      delete campaign.pendingNode
      delete campaign.pendingNextIndex
      enterCampaignNode(campaign, CAMPAIGN, nodeId)
      info(state, events, `📻 阅读状况报告 ${String(report).toUpperCase()}。`)
      progressCampaign(state, events, false)
      settleCampaignHubWindow(state, CAMPAIGN)
      break
    }
    default: throw new Error('未知局外操作')
  }
  state.legalMoves = legalMoves(state)
}

function applyMoveUnchecked(state, seat, move, events) {
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return events
  // 2026-10-25 第七轮修复 05040：「下一次行动期间生效」的排队效果在行动开始时挂上（endOfAction 到期）。
  if (state.pendingActionEffects?.length) {
    const pending = state.pendingActionEffects
    delete state.pendingActionEffects
    for (const record of pending) {
      createEffect(state, { ...record, duration: 'endOfAction', controllerSeat: record.controllerSeat ?? seat })
    }
    info(state, events, `⏳ 本行动期间生效：${pending.map(record => record.label).filter(Boolean).join('、')}`)
  }

  const m = move || {}
  switch (m.action) {
    case 'advanceAct': payAndAdvanceAct(state, events); break
    // 2026-11-13 P1-2：绯红密钥玩家动作。变换必须走机制面包装器（派发 tskKeyShifted 窗口）；
    // 移交只改持有者（Shift/夺取的翻面规则由内容层敌人行动负责，玩家移交不翻面）。
    case 'shiftKey': {
      const shifted = abilityApi(state, events).tsk?.keys?.shift?.(m.keyId, { seat })
      if (!shifted) throw new Error('密钥变换失败')
      info(state, events, `🔑 ${inv.name} 变换了绯红密钥（${shifted.from} → ${shifted.to}）。`)
      break
    }
    case 'transferKey': {
      const previous = abilityApi(state, events).tsk?.keys?.bind?.(m.keyId, { type: 'investigator', seat: m.toSeat })
      if (!previous) throw new Error('密钥移交失败')
      const target = state.investigators.find(other => other.seat === m.toSeat)
      info(state, events, `🔑 ${inv.name} 把绯红密钥移交给${target?.name || '另一名调查员'}。`)
      break
    }
    case 'scenarioAction': scenarioBehavior(state).performAction(state, inv, m, scenarioRuntime(state, events)); break
    case 'shortcutMove': doShortcutMove(state, seat, m, events); break
    case 'detachLocationAttachment': doDetachLocationAttachment(state, seat, m, events); break
    case 'encounterAction': scenarioBehavior(state).performEncounterAction(state, inv, m, scenarioRuntime(state, events)); break
    case 'play': {
      // 2026-10-27「如同手牌」通道统一原语（play-channels.js）：宿主附属 / 直觉牌库 / 银暮匕首下方
      // 旧实现会先把牌放进手牌再走 doPlay；其余通道保留 move 片段交给 doPlay 从来源取牌。
      // 取牌规则、附加费与折扣都在原语里，dispatch 不再逐通道写分支。
      const channelTaken = playChannels.actionTake(state, inv, m, events)
      if (channelTaken?.toHand) {
        const previousBeneath = state._playedFromBeneath
        if (channelTaken.playedFromBeneath) state._playedFromBeneath = { seat, cardCode: m.cardId }
        try {
          doPlay(state, seat, m.cardId, events, false, false, null, null, null, null, channelTaken.playDiscount || 0)
        } finally {
          if (channelTaken.playedFromBeneath) {
            if (previousBeneath === undefined) delete state._playedFromBeneath
            else state._playedFromBeneath = previousBeneath
          }
        }
        playChannels.actionFinish(state, inv, channelTaken, events)
        break
      }
      // 手牌 / 彩绘世界复制 / 弃牌堆顶事件等：沿用原参数传递（通道 move 的片段也走这里）。
      if (m.asIfLocation) beginAsIf(state, inv, m.asIfLocation)
      try {
        doPlay(state, seat, m.cardId, events, !!m.fromDiscard, false, m.copyCode,
          m.fromPlanAssetId, m.fromBackpackId, m.threatId, 0, m.fastSourceId || null)
      } finally {
        if (m.asIfLocation) endAsIf(state, inv)
      }
      break
    }
    case 'draw': doDraw(state, seat, events); break
    case 'resource': doResource(state, seat, events); break
    case 'freeAction': doFreeAction(state, seat, events); break
    case 'hiddenAction': doHiddenAction(state, seat, m, events); break
    case 'move': doMove(state, seat, m.locationId, events); break
    case 'investigate': doInvestigate(state, seat, { basicAction: 'investigate', ...(m.allowNoClues ? { allowNoClues: true } : {}) }, events); break
    case 'explore': doExplore(state, seat, events); break
    case 'searchIzzie': doSearchIzzie(state, seat, events); break
    case 'locationAbility': doLocationAbility(state, seat, m.locationId, events); break
    case 'fight': doFight(state, seat, { enemyId: m.enemyId, basicAction: 'fight' }, events); break
    case 'evade': doEvade(state, seat, { enemyId: m.enemyId, basicAction: 'evade' }, events); break
    case 'extraEvade': doEvade(state, seat, { enemyId: m.enemyId }, events, true); inv.extraEvadeUsed = state.turnSerial; break
    case 'deckTopWeaknessDiscard': discardRevealedDeckTopWeakness(state, seat, events); break
    case 'parley': doParley(state, seat, m.enemyId, events); break
    case 'parleyCultist': doParleyCultist(state, seat, m.enemyId, events); break
    case 'parleyLita': doParleyLita(state, seat, events); break
    case 'drawCultist': doDrawCultist(state, seat, events); break
    case 'interruptRitual': doInterruptRitual(state, seat, m.skill, events); break
    case 'sacrificeLita': doSacrificeLita(state, seat, events); break
    case 'breakDoor': doBreakDoor(state, seat, m.skill, events); break
    // 第 2 步 P2.7：地点/敌人/剧情资产上的通用行动（谈判）——与玩家卡能力同一条描述子管线。
    case 'entityAbility': doEntityAbility(state, seat, m, events); break
    case 'ability': doAbility(state, seat, m.assetId, m.abilityIndex, m.targetId, m.optionIndex, events, m.ownerSeat); break
    case 'discardThreat': doDiscardThreat(state, seat, m.threatId, events); break
    case 'purgeThreat': doPurgeThreat(state, seat, m.threatId, events); break
    case 'payDebt': doPayDebt(state, seat, m.threatId, events); break
    case 'engage': doEngage(state, seat, m.enemyId, events); break
    case 'resign': doResign(state, seat, events); break
    case 'fightHidden':
    case 'evadeHidden': {
      if (!takeHiddenEnemyFromHand(inv, m.cardId)) break
      const card = cardDef(m.cardId) || { code: m.cardId, fight: 0, evade: 0 }
      const enemy = spawnHiddenEnemy(state, inv, card)
      const skill = m.action === 'evadeHidden' ? 'agility' : 'combat'
      const difficulty = m.action === 'evadeHidden' ? (card.evade ?? 0) : (card.fight ?? 0)
      performTest(state, seat, skill, difficulty, {
        source: { label: m.action === 'evadeHidden' ? '躲避' : '攻击', enemyId: enemy.id, name: enemy.name, code: card.code },
        resolve: result => {
          if (result.success) {
            discardSpawnedEnemy(state, inv, enemy)
            info(state, events, `${inv.name} 成功对付了手牌中的敌人，并将其弃掉。`)
          } else {
            info(state, events, `手牌中的敌人生成并与 ${inv.name} 交战。`)
          }
        },
      })
      break
    }
    case 'flipVeiled': {
      const flipped = flipVeiledLocation(state, m.locationId)
      if (flipped.changed) {
        info(state, events, `${inv.name} 翻开了掩藏地点${flipped.storyCode ? `（${flipped.storyCode}）` : ''}。`)
        // P8（M3）：掩藏地点翻面后的章节钩子——读背面故事卡正文、B3《无归之地》的「洗回遭遇牌库」。
        scenarioBehavior(state).veiledFlipped?.(state, inv, m.locationId, flipped, scenarioRuntime(state, events))
      }
      break
    }
    case 'fightConcealed':
    case 'evadeConcealed': {
      // 2026-11-13 P1-16：攻击/躲避隐匿迷你卡——成功即揭露（该效果取代标准效果：
      // 不造成伤害/不躲避敌人；揭露后的真身入场由章节行为或通用回退处理）。
      const mini = (state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || [])
        .find(card => card.id === m.miniId)
      if (!mini || mini.locationId !== inv.location || mini.flipped) break
      const loc = state.locations.find(location => location.id === inv.location)
      const bonus = Number(registeredEntry(loc?.originalCode || loc?.code)?.locationRule?.concealedFightEvadeBonus || 0)
      const miniDifficulty = Math.max(0, Number(loc?.shroud) || 0) + bonus
      const skill = m.action === 'evadeConcealed' ? 'agility' : 'combat'
      performTest(state, seat, skill, miniDifficulty, {
        source: { label: m.action === 'evadeConcealed' ? '躲避隐匿迷你卡' : '攻击隐匿迷你卡', miniId: mini.id },
        resolve: result => {
          if (!result.success) return
          let exposed = null
          try {
            exposed = abilityApi(state, events).tsk?.concealed?.expose(mini.id, { seat })
          } catch (error) {
            info(state, events, `⚠️ 揭露失败：${error.message}`)
            return
          }
          if (!exposed) return
          info(state, events, m.action === 'evadeConcealed'
            ? `💨 ${inv.name} 成功躲避并揭露了一张隐匿迷你卡。`
            : `⚔️ ${inv.name} 成功攻击并揭露了一张隐匿迷你卡。`)
          scenarioBehavior(state).concealedCombatResolved?.(state, exposed, seat, m.action, scenarioRuntime(state, events))
        },
      })
      break
    }
    case 'endTurn': doEndTurn(state, seat, events); break
    default: break
  }

  sampleRoundEvents(state)
  abilityApi(state, events).resolveEmptyUses()
  checkAct(state, events)
  checkDefeated(state, seat, events)
  checkOutcome(state, events)

  // 2026-10-25 第六轮修复 05040：「本次行动期间」的持续效果在行动结算结束时到期。
  expireEffects(state, 'endOfAction')

  if (state.status === 'playing') {
    // 2026-11-13 行为调整（回合收尾不再自动询问）：
    //   · 行动点用尽后**不**自动推进回合，也**不**给行动者本人弹「回合结束前：可以打出快速卡」窗口；
    //     手牌/通道的 0 行动快速卡与 [free] 能力已经是 legalMoves 的直接行动，玩家主动点牌即用；
    //     玩家必须提交 endTurn（或效果强制结束回合 / 离场）才会真正 advanceInvestigator。
    //   · 其他调查员的「任意玩家窗口」能力仍需要窗口（否则行动者 0 行动时队友再无时机），
    //     只给其他座位、行动者本人不参与。
    const acting = state.investigators[seat]
    const closingTurn = !acting || acting.actionsLeft <= 0 || acting.turnEnded || acting.defeated || acting.resigned
    if (state.immediateAction?.seat === seat) return events
    if (closingTurn) {
      playerWindow(state, 'investigation.afterAction', events, null, { betweenActions: true, excludeSeats: [seat] })
    } else {
      playerWindow(state, 'investigation.afterAction', events, null, { betweenActions: true })
    }
    const cur = state.investigators[seat]
    // 只有「结束回合」的显式意图、效果强制结束回合（turnEnded）或调查员离场才推进回合；
    // 行动点花完本身只是进入 0 行动空档期，由玩家自己决定何时点「结束回合」。
    const forcedEnd = !cur || cur.defeated || cur.resigned || cur.turnEnded || move.action === 'endTurn'
    if (forcedEnd) advanceInvestigator(state, seat, events)
  }

  if (state.status === 'playing') {
    state.legalMoves = legalMoves(state)
  } else {
    state.legalMoves = []
  }
  return events
}

  return { applyMove, executeCommand, executeAction, executeHubMove, applyMoveUnchecked }
}
